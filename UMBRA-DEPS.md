# Umbra dependency pinning notes

The Umbra SDK + ZK prover packages are **pinned to exact versions** in
`apps/web/package.json` (no `^` or `~` ranges) because of a metadata mismatch
that we manage explicitly here:

| Package | Version | Notes |
| --- | --- | --- |
| `@umbra-privacy/sdk` | `4.0.0` | Latest. Provides the mixer + claim factories. |
| `@umbra-privacy/web-zk-prover` | `2.0.1` | Latest. Declares peerDep on `@umbra-privacy/sdk@2.0.3`. |
| `@umbra-privacy/umbra-codama` | `2.0.2` | Codama-generated low-level instructions. |

## The peerDep mismatch

`web-zk-prover@2.0.1` is the only version published as of writing, and it
declares `peerDependencies: { "@umbra-privacy/sdk": "2.0.3" }`. We ship
`sdk@4.0.0`. pnpm would warn loudly without help, so the root `package.json`
includes:

```json
"pnpm": {
  "peerDependencyRules": {
    "allowedVersions": {
      "@umbra-privacy/web-zk-prover>@umbra-privacy/sdk": "4.0.0"
    }
  }
}
```

This silences the warning. **The runtime is verified compatible** — the
prover only consumes the `IZkProverFor*` interface shapes from
`@umbra-privacy/sdk/interfaces`, which are stable across 2.x → 4.x. Our
`scripts/umbra-test-mixer-send.ts` exercises both register-side and
claim-side proofs end-to-end and passes.

## Upgrade rules

- **Do NOT bump `^` ranges silently** — every Umbra package version is
  exact for a reason. A minor SDK bump could change the IZkProver interface
  and break the prover at runtime, not at compile time.
- **Before bumping `@umbra-privacy/sdk`**:
  1. Check `web-zk-prover`'s peerDep on the new SDK version.
  2. Run `pnpm umbra:test-mixer-send <agent-uuid>` against a fresh receiver
     ID and confirm Step 5 lands `status=completed`.
  3. Update the `peerDependencyRules` allowedVersions to match.
- **When `web-zk-prover@4.x` ships** (eventual): pin to that, drop the
  `peerDependencyRules` override.
