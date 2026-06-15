package ai.humynlabs.capture.capture

import com.facebook.react.bridge.ReadableMap

/**
 * Phase 3 Plan 03-09 — ReadableMap → Kotlin [CaptureSessionOpts] parser.
 *
 * Mirrors the JS-side Zod schema (`shared/types/src/CaptureSessionOpts.ts`,
 * shipped in Plan 03-04). **Defense-in-depth at the Kotlin bridge end:** the
 * JS Zod schema rejects malformed input first, but a malicious / buggy JS
 * caller could bypass that and call `NativeModules.HumynCapture.start`
 * directly with any ReadableMap. This parser refuses anything that doesn't
 * match D-API-02 verbatim.
 *
 * Lives in its own file (per checker issue #14, surfaced in PLAN.md
 * `<must_haves.truths>`) — NOT nested inside `HumynCaptureModule.kt` —
 * so a Robolectric test can exercise the validation surface in isolation
 * without bringing up Camera2 + MediaCodec.
 *
 * Throw contract:
 *  - Required string missing or empty → `IllegalArgumentException("invalid_opts: <field>")`.
 *  - `taskSetting` outside {`indoor`, `outdoor`} → `"invalid_opts: taskSetting"`.
 *  - `gender` non-null + outside {`male`, `female`, `non-binary`, `prefer-not-to-say`} → `"invalid_opts: gender"`.
 *  - `contributor.consent` not exactly `true` → `IllegalArgumentException("consent_invalid")`.
 *    The bridge module's `start()` maps this to `promise.reject("consent_invalid", ...)`
 *    while every other `IllegalArgumentException` maps to `promise.reject("invalid_opts", ...)`.
 *  - `dfovDegrees` ≤ 0 → `"invalid_opts: dfovDegrees"`.
 *  - `appVersion` not matching the semver regex → `"invalid_opts: appVersion"`.
 *  - `startGate.type` ≠ `"hand_detection"` → `"invalid_opts: startGate.type"`.
 *  - Numeric startGate fields out of range → `"invalid_opts: startGate.<field>"`.
 *
 * No filename or session-id field is accepted — those are server-side
 * (Kotlin) sourced from `FilenameGenerator` + `UlidGenerator` (Plan 03-05).
 * Mitigation for T-3.9-02 path-traversal threat in PLAN.md.
 */
data class CaptureSessionOpts(
    val taskId: String,
    val taskName: String,
    val taskCategory: String,
    val taskSetting: String, // "indoor" | "outdoor"
    val contributor: Contributor,
    val isPractice: Boolean,
    val startGate: StartGateOpts,
    // Bug 3 / D3 (2026-06-04): was `String?` (coarse label). Now the precise
    // [LocationFix] resolved by the JS side (HumynLocation native module) before
    // start(); null when the fix was unavailable.
    val location: LocationFix?,
    val appVersion: String,
    val dfovDegrees: Double,
)

data class Contributor(
    val name: String,
    val email: String,
    val age: Int?,
    val gender: String?, // nullable enum
    val consent: Boolean,
)

data class StartGateOpts(
    val type: String, // literal "hand_detection"
    val passed: Boolean,
    val skipped: Boolean,
    val bypassed: Boolean,
    val durationMs: Int,
    val consecutiveHitsRequired: Int,
    val platformCadenceMs: Int,
)

object CaptureSessionOptsBridge {
    // Mirrors the JS-side schema's appVersion regex shape: M.m.p with
    // optional pre-release / build suffix introduced by `+` or `-`.
    private val SEMVER = Regex("^\\d+\\.\\d+\\.\\d+(?:[+-].+)?$")
    private val ALLOWED_TASK_SETTINGS = setOf("indoor", "outdoor")
    private val ALLOWED_GENDERS = setOf("male", "female", "non-binary", "prefer-not-to-say")

    fun fromBridge(map: ReadableMap): CaptureSessionOpts {
        val taskId = requireNonEmpty(map, "taskId")
        val taskName = requireNonEmpty(map, "taskName")
        val taskCategory = requireNonEmpty(map, "taskCategory")
        val taskSetting = requireString(map, "taskSetting").also {
            require(it in ALLOWED_TASK_SETTINGS) { "invalid_opts: taskSetting" }
        }

        val contributorMap = map.getMap("contributor")
            ?: throw IllegalArgumentException("invalid_opts: contributor")
        // `name` is OPTIONAL since 2026-05-17 (owner decision: profile name
        // must not gate recording). Empty string flows through to the sidecar
        // JSON's `contributor.name`. `email` stays required.
        val contributorName =
            if (contributorMap.isNull("name")) "" else (contributorMap.getString("name") ?: "")
        val contributorEmail = requireNonEmpty(contributorMap, "email")
        val age: Int? = if (contributorMap.isNull("age")) null else contributorMap.getInt("age")
        val gender: String? = if (contributorMap.isNull("gender")) {
            null
        } else {
            val g = contributorMap.getString("gender")
                ?: throw IllegalArgumentException("invalid_opts: gender")
            require(g in ALLOWED_GENDERS) { "invalid_opts: gender" }
            g
        }
        val consent = contributorMap.getBoolean("consent")
        require(consent) { "consent_invalid" }
        val contributor = Contributor(contributorName, contributorEmail, age, gender, consent)

        val isPractice = map.getBoolean("isPractice")

        val sgMap = map.getMap("startGate")
            ?: throw IllegalArgumentException("invalid_opts: startGate")
        val sgType = sgMap.getString("type")
            ?: throw IllegalArgumentException("invalid_opts: startGate.type")
        require(sgType == "hand_detection") { "invalid_opts: startGate.type" }
        val durationMs = sgMap.getInt("durationMs").also {
            require(it >= 0) { "invalid_opts: startGate.durationMs" }
        }
        val consecutiveHitsRequired = sgMap.getInt("consecutiveHitsRequired").also {
            require(it > 0) { "invalid_opts: startGate.consecutiveHitsRequired" }
        }
        val platformCadenceMs = sgMap.getInt("platformCadenceMs").also {
            require(it > 0) { "invalid_opts: startGate.platformCadenceMs" }
        }
        val startGate = StartGateOpts(
            type = sgType,
            passed = sgMap.getBoolean("passed"),
            skipped = sgMap.getBoolean("skipped"),
            bypassed = sgMap.getBoolean("bypassed"),
            durationMs = durationMs,
            consecutiveHitsRequired = consecutiveHitsRequired,
            platformCadenceMs = platformCadenceMs,
        )

        val location = if (map.isNull("location")) null else parseLocation(map)
        val appVersion = requireString(map, "appVersion").also {
            require(SEMVER.matches(it)) { "invalid_opts: appVersion" }
        }
        val dfovDegrees = map.getDouble("dfovDegrees").also {
            require(it > 0) { "invalid_opts: dfovDegrees" }
        }
        return CaptureSessionOpts(
            taskId = taskId,
            taskName = taskName,
            taskCategory = taskCategory,
            taskSetting = taskSetting,
            contributor = contributor,
            isPractice = isPractice,
            startGate = startGate,
            location = location,
            appVersion = appVersion,
            dfovDegrees = dfovDegrees,
        )
    }

    private fun requireString(map: ReadableMap, key: String): String =
        map.getString(key) ?: throw IllegalArgumentException("invalid_opts: $key")

    private fun requireNonEmpty(map: ReadableMap, key: String): String =
        requireString(map, key).also { require(it.isNotEmpty()) { "invalid_opts: $key" } }

    /**
     * Bug 3 / D3 — parse the precise `location` ReadableMap into a [LocationFix].
     * Defense-in-depth: a malformed location block (wrong type / missing field)
     * throws `invalid_opts: location` rather than corrupting the sidecar. The
     * caller has already confirmed `!map.isNull("location")`.
     */
    private fun parseLocation(map: ReadableMap): LocationFix {
        val loc = map.getMap("location")
            ?: throw IllegalArgumentException("invalid_opts: location")
        val provider = loc.getString("provider")
        require(!provider.isNullOrEmpty()) { "invalid_opts: location.provider" }
        val capturedAt = loc.getString("captured_at")
        require(!capturedAt.isNullOrEmpty()) { "invalid_opts: location.captured_at" }
        return LocationFix(
            lat = loc.getDouble("lat"),
            lng = loc.getDouble("lng"),
            accuracyM = loc.getDouble("accuracy_m"),
            provider = provider,
            capturedAt = capturedAt,
            label = if (loc.isNull("label")) null else loc.getString("label"),
        )
    }
}
