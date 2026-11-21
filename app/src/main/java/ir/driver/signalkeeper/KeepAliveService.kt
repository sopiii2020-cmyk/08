package ir.driver.signalkeeper

import android.Manifest
import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.location.GnssStatus
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.wifi.WifiManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import androidx.core.location.LocationManagerCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import org.json.JSONArray
import org.json.JSONObject
import java.net.InetSocketAddress
import java.net.Socket
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import kotlin.math.roundToInt

data class NativePingSample(
    val id: Int,
    val timestamp: Long,
    val latencyMs: Int?,
    val ok: Boolean
)

data class ServiceSnapshot(
    val running: Boolean = false,
    val accuracyMeters: Float? = null,
    val speedKmh: Int? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val altitude: Double? = null,
    val lastFixTimeMs: Long? = null,
    val gnssSatellitesUsed: Int = 0,
    val gnssSatellitesTotal: Int = 0,
    val networkLabel: String = "نامشخص",
    val latencyMs: Int? = null,
    val dropCount: Int = 0,
    val xtraInjected: Boolean = false,
    val pingHistory: List<NativePingSample> = emptyList()
)

object KeepAliveState {
    private val mainHandler = Handler(Looper.getMainLooper())
    private val listeners = CopyOnWriteArrayList<(ServiceSnapshot) -> Unit>()
    private val closeListeners = CopyOnWriteArrayList<() -> Unit>()
    private val sampleIdGen = AtomicInteger(1)

    @Volatile
    var snapshot: ServiceSnapshot = ServiceSnapshot()
        private set

    fun nextSampleId(): Int = sampleIdGen.getAndIncrement()

    fun update(transform: (ServiceSnapshot) -> ServiceSnapshot) {
        val next = transform(snapshot)
        snapshot = next
        mainHandler.post {
            listeners.forEach { it(next) }
        }
    }

    fun addListener(listener: (ServiceSnapshot) -> Unit) {
        listeners.add(listener)
        listener(snapshot)
    }

    fun removeListener(listener: (ServiceSnapshot) -> Unit) {
        listeners.remove(listener)
    }

    fun addCloseListener(listener: () -> Unit) {
        closeListeners.add(listener)
    }

    fun removeCloseListener(listener: () -> Unit) {
        closeListeners.remove(listener)
    }

    fun triggerForceClose() {
        mainHandler.post {
            closeListeners.forEach { it() }
        }
    }

    fun toJson(context: Context): String {
        val s = snapshot
        val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        val ignoringBattery = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pm.isIgnoringBatteryOptimizations(context.packageName)
        } else {
            true
        }
        val snappInstalled = context.packageManager.getLaunchIntentForPackage("cab.snapp.driver") != null
        val fineLocationGranted = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        val backgroundLocationGranted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.ACCESS_BACKGROUND_LOCATION
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            fineLocationGranted
        }

        val lm = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
        val locationEnabled = LocationManagerCompat.isLocationEnabled(lm)

        val arr = JSONArray()
        for (sample in s.pingHistory) {
            arr.put(
                JSONObject().apply {
                    put("id", sample.id)
                    put("timestamp", sample.timestamp)
                    put("latencyMs", sample.latencyMs ?: JSONObject.NULL)
                    put("ok", sample.ok)
                }
            )
        }

        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val activeCaps = cm.getNetworkCapabilities(cm.activeNetwork)
        val effectiveNetworkLabel = if (!s.running && s.networkLabel == "نامشخص") {
            describeNetworkCaps(activeCaps)
        } else {
            s.networkLabel
        }

        return JSONObject().apply {
            put("running", s.running)
            put("accuracyMeters", s.accuracyMeters?.toDouble() ?: JSONObject.NULL)
            put("speedKmh", s.speedKmh ?: JSONObject.NULL)
            put("latitude", s.latitude ?: JSONObject.NULL)
            put("longitude", s.longitude ?: JSONObject.NULL)
            put("altitude", s.altitude ?: JSONObject.NULL)
            put("lastFixTimeMs", s.lastFixTimeMs ?: JSONObject.NULL)
            put("gnssSatellitesUsed", s.gnssSatellitesUsed)
            put("gnssSatellitesTotal", s.gnssSatellitesTotal)
            put("fineLocationGranted", fineLocationGranted)
            put("backgroundLocationGranted", backgroundLocationGranted)
            put("locationEnabled", locationEnabled)
            put("networkLabel", effectiveNetworkLabel)
            put("latencyMs", s.latencyMs ?: JSONObject.NULL)
            put("dropCount", s.dropCount)
            put("xtraInjected", s.xtraInjected)
            put("snappInstalled", snappInstalled)
            put("ignoringBattery", ignoringBattery)
            put("pingHistory", arr)
        }.toString()
    }

    fun describeNetworkCaps(caps: NetworkCapabilities?): String {
        if (caps == null) return "بدون اینترنت"
        val validated = caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
        return when {
            caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) ->
                if (validated) "دیتای سیم‌کارت" else "دیتای سیم‌کارت (ناپایدار)"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ->
                if (validated) "Wi-Fi" else "Wi-Fi بدون اینترنت"
            else -> "متصل"
        }
    }
}

class KeepAliveService : Service() {

    private var locationManager: LocationManager? = null
    private var fusedClient: FusedLocationProviderClient? = null
    private var fusedCallback: LocationCallback? = null
    private var gnssCallback: GnssStatus.Callback? = null
    private var connectivityManager: ConnectivityManager? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var wifiLock: WifiManager.WifiLock? = null
    private var scheduler: ScheduledExecutorService? = null
    private var networkCallback: ConnectivityManager.NetworkCallback? = null
    private var lastXtraRefreshMs: Long = 0L

    private val locationListener = object : LocationListener {
        override fun onLocationChanged(location: Location) {
            recordLocationUpdate(location)
        }

        @Deprecated("Deprecated in Java")
        override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
        override fun onProviderEnabled(provider: String) {}
        override fun onProviderDisabled(provider: String) {}
    }

    private fun recordLocationUpdate(location: Location) {
        val currentAcc = KeepAliveState.snapshot.accuracyMeters
        val lastTime = KeepAliveState.snapshot.lastFixTimeMs ?: 0L
        val incomingAcc = if (location.hasAccuracy()) location.accuracy else Float.MAX_VALUE
        val now = System.currentTimeMillis()
        // Prefer more accurate fix if a recent high-accuracy fix arrived within 3 seconds
        if (currentAcc != null && incomingAcc > currentAcc + 15f && (now - lastTime) < 3000L) {
            return
        }

        val speedKmh = if (location.hasSpeed()) (location.speed * 3.6f).roundToInt() else null
        KeepAliveState.update {
            it.copy(
                running = true,
                accuracyMeters = if (location.hasAccuracy()) location.accuracy else null,
                speedKmh = speedKmh,
                latitude = location.latitude,
                longitude = location.longitude,
                altitude = if (location.hasAltitude()) location.altitude else null,
                lastFixTimeMs = now
            )
        }
        syncSystemUi()
    }

    override fun onCreate() {
        super.onCreate()
        createSilentNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopServiceGracefully(closeUi = intent.getBooleanExtra(EXTRA_CLOSE_UI, false))
                return START_NOT_STICKY
            }
            ACTION_PING_NOW -> {
                Executors.newSingleThreadExecutor().execute { executeProbeAndRecord() }
                return START_STICKY
            }
            ACTION_REFRESH_XTRA -> {
                val lm = getSystemService(Context.LOCATION_SERVICE) as LocationManager
                val ok = triggerAgpsRefresh(lm)
                KeepAliveState.update { it.copy(xtraInjected = ok) }
                return START_STICKY
            }
        }

        val notification = buildSilentNotification("تازه‌سازی A-GPS، قفل ماهواره و پایدارسازی اتصال...")
        val serviceType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
        } else {
            0
        }
        try {
            ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, serviceType)
        } catch (_: Throwable) {
            KeepAliveState.update { it.copy(running = false) }
            stopSelf()
            runCatching {
                startActivity(Intent(this, MainActivity::class.java).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                    putExtra(MainActivity.EXTRA_SILENT_START, true)
                })
            }
            return START_NOT_STICKY
        }

        KeepAliveState.update { it.copy(running = true) }
        acquireLocks()
        startLocationUpdates()
        startNetworkMonitor()
        startLatencyKeepAliveProbe()
        syncSystemUi()

        return START_STICKY
    }

    private fun stopServiceGracefully(closeUi: Boolean) {
        cleanupResources()
        KeepAliveState.update { it.copy(running = false) }
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
        stopSelf()
        SignalTileService.requestSync(this)
        SignalWidgetProvider.updateAllWidgets(this)
        if (closeUi) {
            KeepAliveState.triggerForceClose()
        }
    }

    private fun acquireLocks() {
        runCatching {
            if (wakeLock?.isHeld != true) {
                val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "DriverSignalKeeper::KeepAlive").apply {
                    setReferenceCounted(false)
                    acquire(12 * 60 * 60 * 1000L)
                }
            }
        }
        runCatching {
            if (wifiLock?.isHeld != true) {
                val wm = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
                val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    WifiManager.WIFI_MODE_FULL_LOW_LATENCY
                } else {
                    @Suppress("DEPRECATION")
                    WifiManager.WIFI_MODE_FULL_HIGH_PERF
                }
                wifiLock = wm.createWifiLock(mode, "DriverSignalKeeper::WifiLock").apply {
                    setReferenceCounted(false)
                    acquire()
                }
            }
        }
    }

    @SuppressLint("MissingPermission")
    private fun startLocationUpdates() {
        val hasFine = ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        if (!hasFine) return

        val lm = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        locationManager = lm

        val xtraOk = triggerAgpsRefresh(lm)
        lastXtraRefreshMs = System.currentTimeMillis()
        KeepAliveState.update { it.copy(xtraInjected = xtraOk) }

        runCatching {
            if (lm.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000L, 0f, locationListener, Looper.getMainLooper())
                lm.getLastKnownLocation(LocationManager.GPS_PROVIDER)?.let { last ->
                    if (System.currentTimeMillis() - last.time < 30_000L) {
                        recordLocationUpdate(last)
                    }
                }
            }
        }
        runCatching {
            if (lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                lm.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 4000L, 0f, locationListener, Looper.getMainLooper())
            }
        }

        // Track real GNSS satellite count used in fix
        if (gnssCallback == null) {
            val cb = object : GnssStatus.Callback() {
                override fun onSatelliteStatusChanged(status: GnssStatus) {
                    var used = 0
                    val total = status.satelliteCount
                    for (i in 0 until total) {
                        if (status.usedInFix(i)) used++
                    }
                    KeepAliveState.update {
                        it.copy(gnssSatellitesUsed = used, gnssSatellitesTotal = total)
                    }
                }
            }
            gnssCallback = cb
            runCatching {
                lm.registerGnssStatusCallback(cb, Handler(Looper.getMainLooper()))
            }
        }

        // Also keep Google FusedLocationProvider active at PRIORITY_HIGH_ACCURACY so Snapp/Maps share the lock
        if (fusedCallback == null) {
            runCatching {
                val client = LocationServices.getFusedLocationProviderClient(this)
                fusedClient = client
                val req = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 1000L)
                    .setMinUpdateIntervalMillis(500L)
                    .setWaitForAccurateLocation(false)
                    .build()
                val callback = object : LocationCallback() {
                    override fun onLocationResult(result: LocationResult) {
                        result.lastLocation?.let { recordLocationUpdate(it) }
                    }
                }
                fusedCallback = callback
                client.requestLocationUpdates(req, callback, Looper.getMainLooper())
            }
        }
    }

    private fun startNetworkMonitor() {
        if (networkCallback != null) return
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        connectivityManager = cm
        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                updateNetworkCapabilities(cm, network)
            }

            override fun onCapabilitiesChanged(network: Network, caps: NetworkCapabilities) {
                updateLabelFromCaps(caps)
                syncSystemUi()
            }

            override fun onLost(network: Network) {
                KeepAliveState.update {
                    it.copy(networkLabel = "قطع اتصال", latencyMs = null, dropCount = it.dropCount + 1)
                }
                syncSystemUi()
            }
        }
        networkCallback = callback
        cm.registerDefaultNetworkCallback(callback)
        updateNetworkCapabilities(cm, cm.activeNetwork)
    }

    private fun updateNetworkCapabilities(cm: ConnectivityManager, network: Network?) {
        val caps = if (network != null) cm.getNetworkCapabilities(network) else null
        updateLabelFromCaps(caps)
    }

    private fun updateLabelFromCaps(caps: NetworkCapabilities?) {
        val label = KeepAliveState.describeNetworkCaps(caps)
        KeepAliveState.update { it.copy(networkLabel = label) }
    }

    private fun startLatencyKeepAliveProbe() {
        if (scheduler != null) return
        val exec = Executors.newSingleThreadScheduledExecutor()
        scheduler = exec
        exec.scheduleAtFixedRate({
            val now = System.currentTimeMillis()
            if (now - lastXtraRefreshMs > 20 * 60 * 1000L) {
                locationManager?.let { lm ->
                    val ok = triggerAgpsRefresh(lm)
                    lastXtraRefreshMs = now
                    KeepAliveState.update { it.copy(xtraInjected = ok) }
                }
            }
            executeProbeAndRecord()
        }, 0, 5, TimeUnit.SECONDS)
    }

    private fun executeProbeAndRecord() {
        val measured = measureTcpRttMs("1.1.1.1", 443, 2500)
            ?: measureTcpRttMs("8.8.8.8", 53, 2500)

        val sample = NativePingSample(
            id = KeepAliveState.nextSampleId(),
            timestamp = System.currentTimeMillis(),
            latencyMs = measured,
            ok = measured != null
        )

        KeepAliveState.update { prev ->
            val updatedHistory = (prev.pingHistory + sample).takeLast(20)
            if (measured != null) {
                prev.copy(latencyMs = measured, pingHistory = updatedHistory)
            } else {
                prev.copy(
                    latencyMs = null,
                    dropCount = prev.dropCount + 1,
                    pingHistory = updatedHistory
                )
            }
        }
        if (KeepAliveState.snapshot.running) {
            syncSystemUi()
        }
    }

    private fun measureTcpRttMs(host: String, port: Int, timeoutMs: Int): Int? {
        return try {
            val startNs = System.nanoTime()
            Socket().use { socket ->
                socket.keepAlive = true
                socket.tcpNoDelay = true
                socket.connect(InetSocketAddress(host, port), timeoutMs)
            }
            ((System.nanoTime() - startNs) / 1_000_000L).toInt().coerceAtLeast(1)
        } catch (_: Exception) {
            null
        }
    }

    private fun createSilentNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "سرویس بی‌صدا پایش GPS و آنتن",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "نمایش بی‌صدا هنگام فعال بودن GPS و Keep-Alive"
                setSound(null, null)
                enableVibration(false)
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildSilentNotification(contentText: String): Notification {
        val openIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val stopIntent = PendingIntent.getService(
            this,
            1,
            Intent(this, KeepAliveService::class.java).apply {
                action = ACTION_STOP
                putExtra(EXTRA_CLOSE_UI, true)
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_signal_tile)
            .setContentTitle("پایشگر GPS و اتصال فعال است")
            .setContentText(contentText)
            .setOngoing(true)
            .setSilent(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(openIntent)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "توقف کامل", stopIntent)
            .build()
    }

    private fun syncSystemUi() {
        val s = KeepAliveState.snapshot
        val gpsText = s.accuracyMeters?.let { "GPS ±${it.roundToInt()}m" } ?: "GPS در انتظار قفل"
        val satText = if (s.gnssSatellitesTotal > 0) " (${s.gnssSatellitesUsed}/${s.gnssSatellitesTotal} ماهواره)" else ""
        val pingText = s.latencyMs?.let { "${it}ms" } ?: "بدون پینگ"
        val text = "$gpsText$satText · ${s.networkLabel} ($pingText)"
        runCatching {
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.notify(NOTIFICATION_ID, buildSilentNotification(text))
        }
        SignalTileService.requestSync(this)
        SignalWidgetProvider.updateAllWidgets(this)
    }

    private fun cleanupResources() {
        locationManager?.removeUpdates(locationListener)
        gnssCallback?.let { cb ->
            runCatching { locationManager?.unregisterGnssStatusCallback(cb) }
        }
        gnssCallback = null
        fusedCallback?.let { cb ->
            runCatching { fusedClient?.removeLocationUpdates(cb) }
        }
        fusedCallback = null
        networkCallback?.let { cb ->
            runCatching { connectivityManager?.unregisterNetworkCallback(cb) }
        }
        networkCallback = null
        scheduler?.shutdownNow()
        scheduler = null
        if (wakeLock?.isHeld == true) {
            wakeLock?.release()
        }
        if (wifiLock?.isHeld == true) {
            wifiLock?.release()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        cleanupResources()
        KeepAliveState.update { it.copy(running = false) }
        SignalTileService.requestSync(this)
        SignalWidgetProvider.updateAllWidgets(this)
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        const val CHANNEL_ID = "driver_signal_keeper_silent"
        const val NOTIFICATION_ID = 4102
        const val ACTION_STOP = "ir.driver.signalkeeper.STOP"
        const val ACTION_PING_NOW = "ir.driver.signalkeeper.PING_NOW"
        const val ACTION_REFRESH_XTRA = "ir.driver.signalkeeper.REFRESH_XTRA"
        const val EXTRA_CLOSE_UI = "close_ui"

        fun stopCompletely(context: Context, closeUi: Boolean = false) {
            val appCtx = context.applicationContext
            KeepAliveState.update { it.copy(running = false) }
            runCatching { appCtx.stopService(Intent(appCtx, KeepAliveService::class.java)) }
            if (closeUi) {
                KeepAliveState.triggerForceClose()
            }
            SignalTileService.requestSync(appCtx)
            SignalWidgetProvider.updateAllWidgets(appCtx)
        }

        fun triggerAgpsRefresh(lm: LocationManager): Boolean {
            return try {
                val xtra = lm.sendExtraCommand(LocationManager.GPS_PROVIDER, "force_xtra_injection", null)
                val time = lm.sendExtraCommand(LocationManager.GPS_PROVIDER, "force_time_injection", null)
                xtra || time
            } catch (_: Exception) {
                false
            }
        }
    }
}
