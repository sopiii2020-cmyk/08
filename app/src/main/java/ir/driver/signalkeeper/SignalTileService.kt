package ir.driver.signalkeeper

import android.Manifest
import android.app.PendingIntent
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.drawable.Icon
import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService
import androidx.core.content.ContextCompat
import kotlin.math.roundToInt

class SignalTileService : TileService() {

    override fun onTileAdded() {
        super.onTileAdded()
        syncTileUi()
    }

    override fun onStartListening() {
        super.onStartListening()
        syncTileUi()
    }

    override fun onClick() {
        super.onClick()
        val currentlyRunning = KeepAliveState.snapshot.running
        if (currentlyRunning) {
            KeepAliveService.stopCompletely(this, closeUi = true)
            syncTileUi(forceRunning = false)
            SignalWidgetProvider.updateAllWidgets(this)
            return
        }

        if (canStartLocationServiceFromBackground(this)) {
            val started = try {
                ContextCompat.startForegroundService(
                    this,
                    Intent(this, KeepAliveService::class.java)
                )
                true
            } catch (_: Throwable) {
                false
            }
            if (started) {
                syncTileUi(forceRunning = true)
                SignalWidgetProvider.updateAllWidgets(this)
                return
            }
        }

        val launchIntent = Intent(this, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            putExtra(MainActivity.EXTRA_SILENT_START, true)
        }
        val openAction = Runnable {
            runCatching {
                val pendingIntent = PendingIntent.getActivity(
                    this,
                    101,
                    launchIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                    startActivityAndCollapse(pendingIntent)
                } else {
                    @Suppress("DEPRECATION")
                    startActivityAndCollapse(launchIntent)
                }
            }.onFailure {
                runCatching { startActivity(launchIntent) }
            }
        }
        if (isLocked) {
            unlockAndRun(openAction)
        } else {
            openAction.run()
        }
    }

    private fun syncTileUi(forceRunning: Boolean? = null) {
        val tile = qsTile ?: return
        val s = KeepAliveState.snapshot
        val running = forceRunning ?: s.running

        tile.state = if (running) Tile.STATE_ACTIVE else Tile.STATE_INACTIVE
        tile.label = getString(R.string.tile_label)
        tile.icon = Icon.createWithResource(this, R.drawable.ic_signal_tile)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            tile.subtitle = if (running) {
                val gpsPart = s.accuracyMeters?.let { "±${it.roundToInt()}m" }
                val pingPart = s.latencyMs?.let { "${it}ms" }
                listOfNotNull(gpsPart, pingPart).joinToString(" · ").ifEmpty { "فعال (بی‌صدا)" }
            } else {
                "خاموش"
            }
        }
        tile.updateTile()
    }

    companion object {
        fun requestSync(context: Context) {
            runCatching {
                requestListeningState(
                    context.applicationContext,
                    ComponentName(context.applicationContext, SignalTileService::class.java)
                )
            }
        }

        fun canStartLocationServiceFromBackground(context: Context): Boolean {
            val hasFine = ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.ACCESS_FINE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED
            if (!hasFine) return false

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                return ContextCompat.checkSelfPermission(
                    context,
                    Manifest.permission.ACCESS_BACKGROUND_LOCATION
                ) == PackageManager.PERMISSION_GRANTED
            }
            return true
        }
    }
}
