package ai.humynlabs.capture.capture

import android.app.Application
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import java.io.File

/**
 * Plan 03-08 Task 2 — CAP-04 + CAP-05 IMU CSV row format.
 *
 * Locks the IMU CSV row format against `idea-brief.md §6.4 / §8.2`:
 *   `timestamp_ns,sensor_type,x,y,z\n`
 * with `sensor_type` ∈ {"gyro", "accel"} and values in native sensor
 * units (rad/s for gyro, m/s² for accel). Both sensors interleaved by
 * timestamp in ONE file (not separate gyro / accel files).
 *
 * `formatRow` is the pure-fn seam — no SensorManager registration, no
 * BufferedWriter, no HandlerThread. The integration path (registering
 * listeners, reading SensorEvent.timestamp values, writing rows to a
 * BufferedWriter) is exercised by Plan 03-10 CaptureSession integration
 * tests + Phase 4 manual smoke; this test only locks the row shape.
 *
 * `application = Application::class` matches Plan 03-04's pattern.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], application = Application::class)
class ImuWriterCsvFormatTest {

    @Test
    fun `formatRow emits canonical CSV format for gyro sample`() {
        val tmp = File(RuntimeEnvironment.getApplication().cacheDir, "imu-format-1.csv")
        try {
            val w = ImuWriter(RuntimeEnvironment.getApplication(), tmp)
            try {
                val row = w.formatRow(123_456_789L, "gyro", 0.1f, -0.2f, 0.3f)
                assertEquals("123456789,gyro,0.1,-0.2,0.3\n", row)
            } finally {
                w.close()
            }
        } finally {
            tmp.delete()
        }
    }

    @Test
    fun `formatRow emits canonical format for accel sample`() {
        val tmp = File(RuntimeEnvironment.getApplication().cacheDir, "imu-format-2.csv")
        try {
            val w = ImuWriter(RuntimeEnvironment.getApplication(), tmp)
            try {
                val row = w.formatRow(987_654_321L, "accel", 9.81f, 0.0f, -0.05f)
                assertEquals("987654321,accel,9.81,0.0,-0.05\n", row)
            } finally {
                w.close()
            }
        } finally {
            tmp.delete()
        }
    }

    @Test
    fun `formatRow column count is exactly 5 for every row`() {
        val tmp = File(RuntimeEnvironment.getApplication().cacheDir, "imu-format-3.csv")
        try {
            val w = ImuWriter(RuntimeEnvironment.getApplication(), tmp)
            try {
                val rows = listOf(
                    w.formatRow(1L, "gyro", 1f, 2f, 3f),
                    w.formatRow(2L, "accel", 0.1f, 0.2f, 0.3f),
                )
                for (r in rows) {
                    val cols = r.trimEnd('\n').split(",")
                    assertEquals("row=$r", 5, cols.size)
                    assertEquals("row=$r ends with newline", '\n', r.last())
                }
            } finally {
                w.close()
            }
        } finally {
            tmp.delete()
        }
    }

    @Test
    fun `every CSV starts with the canonical header row`() {
        val tmp = File(RuntimeEnvironment.getApplication().cacheDir, "imu-header-1.csv")
        try {
            // Construct then close immediately — no data rows. The file must
            // still be a valid CSV: header line, nothing else.
            val w = ImuWriter(RuntimeEnvironment.getApplication(), tmp)
            w.close()
            assertEquals("timestamp_ns,sensor_type,x,y,z\n", ImuWriter.CSV_HEADER)
            assertEquals(ImuWriter.CSV_HEADER, tmp.readText())
        } finally {
            tmp.delete()
        }
    }

    @Test
    fun `writeRowForTest persists rows to disk verbatim after the header`() {
        val tmp = File(RuntimeEnvironment.getApplication().cacheDir, "imu-write-1.csv")
        try {
            val w = ImuWriter(RuntimeEnvironment.getApplication(), tmp)
            w.writeRowForTest(100L, "gyro", 0.5f, -0.5f, 0.0f)
            w.writeRowForTest(200L, "accel", 9.8f, 0.0f, 0.1f)
            // close() finalizes the BufferedWriter and unregisters
            // listeners — the on-disk bytes match the header + the in-memory rows.
            w.close()
            val text = tmp.readText()
            assertEquals(
                ImuWriter.CSV_HEADER + "100,gyro,0.5,-0.5,0.0\n200,accel,9.8,0.0,0.1\n",
                text,
            )
            // Line 1 is exactly the column-name header.
            assertEquals("timestamp_ns,sensor_type,x,y,z", text.lineSequence().first())
        } finally {
            tmp.delete()
        }
    }

    @Test
    fun `timestamps reflects all rows written`() {
        val tmp = File(RuntimeEnvironment.getApplication().cacheDir, "imu-ts-1.csv")
        try {
            val w = ImuWriter(RuntimeEnvironment.getApplication(), tmp)
            w.writeRowForTest(1L, "gyro", 0f, 0f, 0f)
            w.writeRowForTest(2L, "accel", 0f, 0f, 0f)
            w.writeRowForTest(3L, "gyro", 0f, 0f, 0f)
            val ts = w.timestamps()
            assertEquals(3, ts.size)
            assertEquals(1L, ts[0])
            assertEquals(2L, ts[1])
            assertEquals(3L, ts[2])
            w.close()
        } finally {
            tmp.delete()
        }
    }
}
