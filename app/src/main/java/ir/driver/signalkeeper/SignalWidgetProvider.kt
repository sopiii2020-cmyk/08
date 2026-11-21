package ir.driver.signalkeeper

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.widget.RemoteViews
import androidx.core.content.ContextCompat
import kotlin.math.roundToInt

class SignalWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            updateSingleWidget(context, appWidgetManager, appWidgetId)
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == ACTION_TOGGLE_SERVICE) {
            if (KeepAliveState.snapshot.running) {
                KeepAliveService.stopCompletely(context, closeUi = true)
                updateAllWidgets(context)
                SignalTileService.requestSync(context)
            } else {
                var started = false
                if (SignalTileService.canStartLocationServiceFromBackground(context)) {
                    started = try {
                        ContextCompat.startForegroundService(
                            context,
                            Intent(context, KeepAliveService::class.java)
                        )
                        true
                    } catch (_: Throwable) {
                        false
                    }
                }
                if (!started) {
                    runCatching {
                        val launchIntent = Intent(context, MainActivity::class.java).apply {
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                            putExtra(MainActivity.EXTRA_SILENT_START, true)
                        }
                        context.startActivity(launchIntent)
                    }
                } else {
                    updateAllWidgets(context)
                    SignalTileService.requestSync(context)
                }
            }
        }
    }

    companion object {
        const val ACTION_TOGGLE_SERVICE = "ir.driver.signalkeeper.WIDGET_TOGGLE_SERVICE"

        fun updateAllWidgets(context: Context) {
            val appContext = context.applicationContext
            val manager = AppWidgetManager.getInstance(appContext)
            val ids = manager.getAppWidgetIds(
                ComponentName(appContext, SignalWidgetProvider::class.java)
            )
            for (id in ids) {
                updateSingleWidget(appContext, manager, id)
            }
        }

        private fun updateSingleWidget(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int
        ) {
            val s = KeepAliveState.snapshot
            val running = s.running
            val views = RemoteViews(context.packageName, R.layout.widget_signal_keeper)

            views.setTextViewText(R.id.widgetStatus, if (running) "فعال" else "خاموش")
            views.setTextColor(
                R.id.widgetStatus,
                if (running) Color.parseColor("#0F766E") else Color.parseColor("#64748B")
            )

            val gpsText = s.accuracyMeters?.let { "±${it.roundToInt()} متر" } ?: "—"
            val pingText = s.latencyMs?.let { "${it} ms" } ?: "—"
            val netText = if (running) s.networkLabel else "آماده"

            views.setTextViewText(R.id.widgetGpsAccuracy, gpsText)
            views.setTextViewText(R.id.widgetPing, pingText)
            views.setTextViewText(R.id.widgetNetwork, netText)

            views.setTextViewText(
                R.id.widgetToggleButton,
                if (running) "توقف و بستن کامل" else "شروع بی‌صدا در پس‌زمینه"
            )
            views.setInt(
                R.id.widgetToggleButton,
                "setBackgroundResource",
                if (running) R.drawable.widget_btn_stop else R.drawable.widget_btn_primary
            )

            val toggleIntent = Intent(context, SignalWidgetProvider::class.java).apply {
                action = ACTION_TOGGLE_SERVICE
            }
            val togglePending = PendingIntent.getBroadcast(
                context,
                201,
                toggleIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widgetToggleButton, togglePending)

            val panelIntent = Intent(context, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }
            val panelPending = PendingIntent.getActivity(
                context,
                202,
                panelIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widgetOpenPanelButton, panelPending)

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}
