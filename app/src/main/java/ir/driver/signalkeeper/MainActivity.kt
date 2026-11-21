package ir.driver.signalkeeper

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.location.LocationManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.result.IntentSenderRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.webkit.WebViewAssetLoader
import com.google.android.gms.common.api.ResolvableApiException
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.LocationSettingsRequest
import com.google.android.gms.location.Priority
import java.util.concurrent.Executors

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private var launchSnappAfterPermission = false
    private var silentStartPending = false

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { results ->
        val fineGranted = results[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
            ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val coarseGranted = results[Manifest.permission.ACCESS_COARSE_LOCATION] == true ||
            ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

        if (fineGranted || coarseGranted) {
            if (!fineGranted) {
                Toast.makeText(
                    this,
                    "لطفاً در تنظیمات، دسترسی موقعیت را روی «دقیق (Precise)» قرار دهید.",
                    Toast.LENGTH_LONG
                ).show()
            }
            startKeepAliveService()
            if (launchSnappAfterPermission) {
                launchSnappAfterPermission = false
                launchSnappDriver()
            }
        } else {
            launchSnappAfterPermission = false
            silentStartPending = false
            Toast.makeText(this, "برای فعال‌سازی پایدارساز GPS دسترسی موقعیت مکانی لازم است.", Toast.LENGTH_LONG).show()
        }
        pushStateToWeb()
    }

    private val locationSettingsLauncher = registerForActivityResult(
        ActivityResultContracts.StartIntentSenderForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            Toast.makeText(this, "دقت بالای GPS و موقعیت‌یابی گوگل فعال شد.", Toast.LENGTH_SHORT).show()
            if (KeepAliveState.snapshot.running) {
                startKeepAliveService()
            }
        }
        pushStateToWeb()
    }

    private val stateListener: (ServiceSnapshot) -> Unit = { snap ->
        pushStateToWeb()
        if (silentStartPending && snap.running) {
            silentStartPending = false
            runOnUiThread {
                Toast.makeText(this, "پایدارساز GPS و شبکه در پس‌زمینه فعال شد.", Toast.LENGTH_SHORT).show()
                finishAndRemoveTask()
            }
        }
    }

    private val closeListener: () -> Unit = {
        runOnUiThread {
            silentStartPending = false
            finishAndRemoveTask()
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this).apply {
            setBackgroundColor(Color.parseColor("#F8FAFC"))
        }
        setContentView(webView)

        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            cacheMode = WebSettings.LOAD_NO_CACHE
        }

        webView.webChromeClient = WebChromeClient()
        webView.addJavascriptInterface(NativeBridge(), "NativeAndroidBridge")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest
            ): WebResourceResponse? {
                val response = runCatching { assetLoader.shouldInterceptRequest(request.url) }.getOrNull()
                    ?: return null
                val path = request.url.path ?: ""
                val fixedMime = when {
                    path.endsWith(".js", ignoreCase = true) || path.endsWith(".mjs", ignoreCase = true) -> "application/javascript"
                    path.endsWith(".css", ignoreCase = true) -> "text/css"
                    path.endsWith(".html", ignoreCase = true) -> "text/html"
                    path.endsWith(".svg", ignoreCase = true) -> "image/svg+xml"
                    path.endsWith(".json", ignoreCase = true) -> "application/json"
                    else -> response.mimeType ?: "application/octet-stream"
                }
                val safeEncoding = response.encoding?.takeIf { it.isNotBlank() } ?: "UTF-8"
                val safeStatus = if (response.statusCode in 100..599) response.statusCode else 200
                val safeReason = response.reasonPhrase?.takeIf { it.isNotBlank() } ?: "OK"
                val headers = (response.responseHeaders ?: emptyMap()).toMutableMap()
                headers["Access-Control-Allow-Origin"] = "*"
                return WebResourceResponse(
                    fixedMime,
                    safeEncoding,
                    safeStatus,
                    safeReason,
                    headers,
                    response.data
                )
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                pushStateToWeb()
            }
        }

        webView.loadUrl("https://appassets.androidplatform.net/assets/www/index.html")
        handleLaunchIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleLaunchIntent(intent)
    }

    private fun handleLaunchIntent(launchIntent: Intent?) {
        if (launchIntent?.getBooleanExtra(EXTRA_SILENT_START, false) == true) {
            silentStartPending = true
            ensurePermissionsAndStart(alsoLaunchSnapp = false)
        }
    }

    override fun onStart() {
        super.onStart()
        KeepAliveState.addListener(stateListener)
        KeepAliveState.addCloseListener(closeListener)
    }

    override fun onResume() {
        super.onResume()
        pushStateToWeb()
    }

    override fun onStop() {
        super.onStop()
        KeepAliveState.removeListener(stateListener)
        KeepAliveState.removeCloseListener(closeListener)
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (this::webView.isInitialized && webView.canGoBack()) {
            webView.goBack()
        } else {
            @Suppress("DEPRECATION")
            super.onBackPressed()
        }
    }

    private fun pushStateToWeb() {
        if (!this::webView.isInitialized) return
        val json = KeepAliveState.toJson(this)
        runOnUiThread {
            webView.evaluateJavascript(
                "window.__onNativeState && window.__onNativeState($json);",
                null
            )
        }
    }

    private fun ensurePermissionsAndStart(alsoLaunchSnapp: Boolean) {
        val needed = mutableListOf<String>()
        val hasFine = ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        val hasCoarse = ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        // Android 12+ requires requesting FINE and COARSE together
        if (!hasFine) {
            needed.add(Manifest.permission.ACCESS_FINE_LOCATION)
            if (!hasCoarse) {
                needed.add(Manifest.permission.ACCESS_COARSE_LOCATION)
            }
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            needed.add(Manifest.permission.POST_NOTIFICATIONS)
        }

        if (needed.isEmpty()) {
            startKeepAliveService()
            if (alsoLaunchSnapp) launchSnappDriver()
        } else {
            launchSnappAfterPermission = alsoLaunchSnapp
            permissionLauncher.launch(needed.toTypedArray())
        }
    }

    private fun requestHighAccuracyLocationPrompt() {
        val req = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 1000L).build()
        val builder = LocationSettingsRequest.Builder()
            .addLocationRequest(req)
            .setAlwaysShow(true)

        LocationServices.getSettingsClient(this)
            .checkLocationSettings(builder.build())
            .addOnSuccessListener {
                Toast.makeText(this, "دقت بالای GPS و موقعیت‌یابی گوگل هم‌اکنون فعال است.", Toast.LENGTH_SHORT).show()
                pushStateToWeb()
            }
            .addOnFailureListener { ex ->
                if (ex is ResolvableApiException) {
                    runCatching {
                        val reqSender = IntentSenderRequest.Builder(ex.resolution).build()
                        locationSettingsLauncher.launch(reqSender)
                    }.onFailure {
                        openBestIntent(Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS))
                    }
                } else {
                    openBestIntent(Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS))
                }
            }
    }

    private fun startKeepAliveService() {
        val intent = Intent(this, KeepAliveService::class.java)
        ContextCompat.startForegroundService(this, intent)
    }

    private fun stopKeepAliveService() {
        KeepAliveService.stopCompletely(this, closeUi = false)
    }

    private fun launchSnappDriver() {
        val launchIntent = packageManager.getLaunchIntentForPackage(SNAPP_DRIVER_PKG)
        if (launchIntent != null) {
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            startActivity(launchIntent)
        } else {
            Toast.makeText(this, "اپلیکیشن اسنپ رانندگان روی گوشی یافت نشد.", Toast.LENGTH_LONG).show()
        }
    }

    private fun openBestIntent(primary: Intent, fallback: Intent? = null) {
        try {
            startActivity(primary)
        } catch (_: Exception) {
            if (fallback != null) {
                runCatching { startActivity(fallback) }
            } else {
                Toast.makeText(this, "صفحه تنظیمات در این گوشی در دسترس نبود.", Toast.LENGTH_SHORT).show()
            }
        }
    }

    inner class NativeBridge {
        @JavascriptInterface
        fun startServiceAndLaunchSnapp() {
            runOnUiThread { ensurePermissionsAndStart(alsoLaunchSnapp = true) }
        }

        @JavascriptInterface
        fun startKeepAlive() {
            runOnUiThread { ensurePermissionsAndStart(alsoLaunchSnapp = false) }
        }

        @JavascriptInterface
        fun stopKeepAlive() {
            runOnUiThread { stopKeepAliveService() }
        }

        @JavascriptInterface
        fun refreshAgpsXtra(): Boolean {
            val lm = getSystemService(Context.LOCATION_SERVICE) as LocationManager
            val ok = KeepAliveService.triggerAgpsRefresh(lm)
            KeepAliveState.update { it.copy(xtraInjected = ok) }
            return ok
        }

        @JavascriptInterface
        fun requestHighAccuracyDialog() {
            runOnUiThread { requestHighAccuracyLocationPrompt() }
        }

        @JavascriptInterface
        fun openSelfLocationPermission() {
            runOnUiThread {
                val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                    data = Uri.parse("package:$packageName")
                }
                openBestIntent(intent, Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS))
            }
        }

        @JavascriptInterface
        fun runPingNow() {
            if (KeepAliveState.snapshot.running) {
                startService(Intent(this@MainActivity, KeepAliveService::class.java).apply {
                    action = KeepAliveService.ACTION_PING_NOW
                })
            } else {
                Executors.newSingleThreadExecutor().execute {
                    val startNs = System.nanoTime()
                    val latency = try {
                        java.net.Socket().use { s ->
                            s.connect(java.net.InetSocketAddress("1.1.1.1", 443), 2500)
                        }
                        ((System.nanoTime() - startNs) / 1_000_000L).toInt().coerceAtLeast(1)
                    } catch (_: Exception) {
                        null
                    }
                    val sample = NativePingSample(
                        id = KeepAliveState.nextSampleId(),
                        timestamp = System.currentTimeMillis(),
                        latencyMs = latency,
                        ok = latency != null
                    )
                    KeepAliveState.update { prev ->
                        prev.copy(
                            latencyMs = latency,
                            dropCount = if (latency == null) prev.dropCount + 1 else prev.dropCount,
                            pingHistory = (prev.pingHistory + sample).takeLast(20)
                        )
                    }
                }
            }
        }

        @JavascriptInterface
        fun openApnSettings() {
            runOnUiThread {
                openBestIntent(
                    Intent(Settings.ACTION_APN_SETTINGS),
                    Intent(Settings.ACTION_WIRELESS_SETTINGS)
                )
            }
        }

        @JavascriptInterface
        fun openLocationSettings() {
            runOnUiThread { openBestIntent(Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS)) }
        }

        @JavascriptInterface
        fun openSnappBatterySettings() {
            runOnUiThread {
                val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                    data = Uri.parse("package:$SNAPP_DRIVER_PKG")
                }
                openBestIntent(intent, Intent(Settings.ACTION_APPLICATION_SETTINGS))
            }
        }

        @JavascriptInterface
        fun requestIgnoreBattery() {
            runOnUiThread {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
                    if (!pm.isIgnoringBatteryOptimizations(packageName)) {
                        val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                            data = Uri.parse("package:$packageName")
                        }
                        openBestIntent(intent, Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
                    } else {
                        Toast.makeText(this@MainActivity, "این برنامه از محدودیت باتری معاف است.", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        }

        @JavascriptInterface
        fun getStateJson(): String = KeepAliveState.toJson(this@MainActivity)
    }

    companion object {
        private const val SNAPP_DRIVER_PKG = "cab.snapp.driver"
        const val EXTRA_SILENT_START = "silent_start"
    }
}
