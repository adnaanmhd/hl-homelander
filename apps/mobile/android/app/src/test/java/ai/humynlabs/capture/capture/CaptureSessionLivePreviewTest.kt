package ai.humynlabs.capture.capture

import ai.humynlabs.capture.livepreview.LivePreviewSurfaceRegistry
import android.app.Application
import android.view.Surface
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.shadow.api.Shadow

/**
 * Phase 7 plan 07-07 — JVM unit coverage for [LivePreviewSurfaceRegistry], the
 * singleton Surface slot read by `CaptureSession.openCaptureSession` at
 * session-config time + on the JS-driven onAddTarget/onRemoveTarget toggles
 * (Option B two-Surface CaptureSession; the encoder Surface is ALWAYS a
 * target — REC-LIVE-05/07 invariant).
 *
 * The fuller test of the two-Surface session — addTarget toggle, drift A/B
 * — requires real Pixel hardware and is the operator's manual walk in
 * `07-MANUAL-SMOKE.md §9` per D-04. This JVM test pins the registry's
 * shape: null when empty, [Surface] returned when published, the
 * defense-in-depth `slot === s` guard in onSurfaceDestroyed (T-07-07-04),
 * and the callback slots being settable + clearable.
 *
 * Uses Robolectric's `ShadowSurface.newInstance()` to obtain valid
 * [Surface] handles without a GL context (mirrors the
 * `ShadowCameraCharacteristics.newCameraCharacteristics()` seam used by
 * [RealtimeGateTest]).
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], application = Application::class)
class CaptureSessionLivePreviewTest {

    @After
    fun tearDown() {
        // Clear registry between tests so the order is not load-bearing.
        LivePreviewSurfaceRegistry.onSurfaceDestroyed(null)
        LivePreviewSurfaceRegistry.onAddTarget = null
        LivePreviewSurfaceRegistry.onRemoveTarget = null
    }

    @Test
    fun `registry returns null when no preview surface is published`() {
        LivePreviewSurfaceRegistry.onSurfaceDestroyed(null)
        assertNull(LivePreviewSurfaceRegistry.currentSurface())
    }

    @Test
    fun `onSurfaceAvailable publishes Surface and currentSurface returns it`() {
        val s: Surface = Shadow.newInstanceOf(Surface::class.java) as Surface
        LivePreviewSurfaceRegistry.onSurfaceAvailable(s)
        val current = LivePreviewSurfaceRegistry.currentSurface()
        assertNotNull(current)
        assertSame(s, current)
    }

    @Test
    fun `onSurfaceDestroyed with null force-clears the slot`() {
        val s: Surface = Shadow.newInstanceOf(Surface::class.java) as Surface
        LivePreviewSurfaceRegistry.onSurfaceAvailable(s)
        LivePreviewSurfaceRegistry.onSurfaceDestroyed(null)
        assertNull(LivePreviewSurfaceRegistry.currentSurface())
    }

    @Test
    fun `onSurfaceDestroyed with matching Surface clears the slot`() {
        val s: Surface = Shadow.newInstanceOf(Surface::class.java) as Surface
        LivePreviewSurfaceRegistry.onSurfaceAvailable(s)
        LivePreviewSurfaceRegistry.onSurfaceDestroyed(s)
        assertNull(LivePreviewSurfaceRegistry.currentSurface())
    }

    @Test
    fun `onSurfaceDestroyed with non-matching Surface does NOT clear the slot (T-07-07-04)`() {
        // Simulates a re-mount race: an old view's delayed
        // onSurfaceTextureDestroyed callback fires AFTER a new view has
        // already published its Surface. The stale callback must NOT clear
        // the newer slot.
        val sOld: Surface = Shadow.newInstanceOf(Surface::class.java) as Surface
        val sNew: Surface = Shadow.newInstanceOf(Surface::class.java) as Surface
        LivePreviewSurfaceRegistry.onSurfaceAvailable(sOld)
        // Old view's onSurfaceTextureDestroyed fires — clears the slot.
        LivePreviewSurfaceRegistry.onSurfaceDestroyed(sOld)
        assertNull(LivePreviewSurfaceRegistry.currentSurface())
        // New view mounts + publishes.
        LivePreviewSurfaceRegistry.onSurfaceAvailable(sNew)
        // A racy stale onSurfaceTextureDestroyed for sOld fires LATER —
        // must NOT clear sNew's slot.
        LivePreviewSurfaceRegistry.onSurfaceDestroyed(sOld)
        assertSame(sNew, LivePreviewSurfaceRegistry.currentSurface())
    }

    @Test
    fun `onAddTarget and onRemoveTarget callbacks are settable and clearable`() {
        var addCount = 0
        var removeCount = 0
        LivePreviewSurfaceRegistry.onAddTarget = { addCount++ }
        LivePreviewSurfaceRegistry.onRemoveTarget = { removeCount++ }
        LivePreviewSurfaceRegistry.onAddTarget?.invoke()
        LivePreviewSurfaceRegistry.onRemoveTarget?.invoke()
        assertEquals("onAddTarget should fire once", 1, addCount)
        assertEquals("onRemoveTarget should fire once", 1, removeCount)
        LivePreviewSurfaceRegistry.onAddTarget = null
        LivePreviewSurfaceRegistry.onRemoveTarget = null
        assertNull(LivePreviewSurfaceRegistry.onAddTarget)
        assertNull(LivePreviewSurfaceRegistry.onRemoveTarget)
    }
}
