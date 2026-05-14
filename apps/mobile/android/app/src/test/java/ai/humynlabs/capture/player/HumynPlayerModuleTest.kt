package ai.humynlabs.capture.player

import android.app.Application
import org.junit.After
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

/**
 * Plan 06-06 Task 4 — Robolectric coverage for [PlayerController]'s
 * `validateUriScheme()` gate (T-6.6-01) and `release()` idempotence
 * (T-6.6-03 / Pitfall 5 cleanup).
 *
 * `application = Application::class` — bypasses `MainApplication.onCreate`'s
 * SoLoader.init NPE under Robolectric (canonical Phase 3 / 4 / 5 pattern;
 * see UploadCoordinatorTest).
 *
 * Why we test the gate (not the full prepare path): Robolectric does not
 * simulate Android's media-source resolution / codec setup, so an actual
 * `ExoPlayer.prepare()` would either no-op or throw a shadow-implementation
 * error. The test asserts only the URI-scheme gate (hand-rolled, deterministic
 * synchronous code) — for the "accept" cases, we assert the failure (if any)
 * is NOT an `IllegalArgumentException`, which is what the gate throws on
 * reject. Anything else (ExoPlayer construction failure, etc.) is fine for
 * this test's purposes; the JVM-side behavior of ExoPlayer.Builder() is
 * covered by media3's own test suite.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], application = Application::class)
class HumynPlayerModuleTest {

    @After
    fun tearDown() {
        // Defensive — each test that triggered an ExoPlayer.Builder() call
        // (https / file-under-filesDir paths) must release before the next
        // test runs, otherwise PlayerController's singleton state leaks
        // between tests.
        PlayerController.release()
    }

    @Test
    fun prepare_rejectsInvalidUriScheme() {
        val ctx = RuntimeEnvironment.getApplication()
        var threw = false
        PlayerController.prepare(ctx, "ftp://evil.example.com/video.mp4") { result ->
            result.onFailure { if (it is IllegalArgumentException) threw = true }
        }
        assertTrue(
            "ftp:// URI must be rejected with IllegalArgumentException",
            threw,
        )
    }

    @Test
    fun prepare_rejectsFileUriOutsideFilesDir() {
        val ctx = RuntimeEnvironment.getApplication()
        var threw = false
        PlayerController.prepare(ctx, "file:///etc/passwd") { result ->
            result.onFailure { if (it is IllegalArgumentException) threw = true }
        }
        assertTrue(
            "file:// outside filesDir must be rejected with IllegalArgumentException",
            threw,
        )
    }

    @Test
    fun prepare_acceptsHttpsUri() {
        val ctx = RuntimeEnvironment.getApplication()
        var illegalArg = false
        try {
            PlayerController.prepare(ctx, "https://recordings.humyn.ai/path") { result ->
                result.onFailure { if (it is IllegalArgumentException) illegalArg = true }
            }
        } catch (t: Throwable) {
            // ExoPlayer.Builder() could throw under Robolectric; that's OK
            // — the URI gate is what we're testing.
            if (t is IllegalArgumentException) illegalArg = true
        }
        assertFalse(
            "https:// URI must pass the scheme gate (no IllegalArgumentException)",
            illegalArg,
        )
    }

    @Test
    fun prepare_acceptsFileUriUnderFilesDir() {
        val ctx = RuntimeEnvironment.getApplication()
        val filesDir = ctx.filesDir.absolutePath
        var illegalArg = false
        try {
            PlayerController.prepare(ctx, "file://$filesDir/recording.mp4") { result ->
                result.onFailure { if (it is IllegalArgumentException) illegalArg = true }
            }
        } catch (t: Throwable) {
            if (t is IllegalArgumentException) illegalArg = true
        }
        assertFalse(
            "file://<filesDir>/* URI must pass the scheme gate (no IllegalArgumentException)",
            illegalArg,
        )
    }

    @Test
    fun release_isIdempotent() {
        // Whether or not a previous test created a player, calling release()
        // twice in a row must not throw.
        PlayerController.release()
        PlayerController.release()
    }
}
