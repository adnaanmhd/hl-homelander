// @xenova/transformers — Hugging Face JS port. CPU-only ONNX inference.
// Cold-start: first call loads ~24 MB model + tokenizer (~1-3s on Fargate t4g.medium per D-EMB-02).
// Subsequent embeds: ~50-200ms per query.
//
// Critical: pooling='mean' and normalize=true are the bindings the model trains under.
// Both the seed pipeline (apps/api/scripts/seed-tasks.ts) and the search query handler
// (apps/api/src/routes/tasks/search.ts) MUST go through embed() so the configuration
// stays bit-identical. Drift between the two = silent recall collapse on the HNSW index.

import { pipeline, type FeatureExtractionPipeline } from '@xenova/transformers';

const MODEL_ID = 'Xenova/all-MiniLM-L6-v2' as const;
const EMBED_DIMS = 384 as const;

type EmbedderHandle = FeatureExtractionPipeline;

let _embedder: EmbedderHandle | undefined;
let _loadPromise: Promise<EmbedderHandle> | undefined;

async function getEmbedder(): Promise<EmbedderHandle> {
  if (_embedder) return _embedder;
  if (!_loadPromise) {
    _loadPromise = pipeline('feature-extraction', MODEL_ID).then((p) => {
      _embedder = p as EmbedderHandle;
      return _embedder;
    });
  }
  return _loadPromise;
}

// Returns 384 floats (mean-pooled, normalized) — exact same configuration used at seed time.
// Changing pooling or normalize at query time (vs. seed time) breaks recall silently.
export async function embed(text: string): Promise<number[]> {
  const embedder = await getEmbedder();
  const output = await embedder(text, { pooling: 'mean', normalize: true });
  // Tensor.data is a TypedArray (Float32Array for these models)
  const tensorData = (output as { data: Float32Array }).data;
  const arr = Array.from(tensorData);
  if (arr.length !== EMBED_DIMS) {
    throw new Error(`embedder_returned_wrong_dims: expected ${EMBED_DIMS}, got ${arr.length}`);
  }
  return arr;
}

// D-EMB-04: embedded text shape — used by both seed (per task) and search query.
// Excludes instructions, setting, warning per the decision record.
export function buildEmbeddedText(opts: {
  name: string;
  description: string;
  category: string;
}): string {
  return `${opts.name}. ${opts.description}. Category: ${opts.category}.`;
}

// Pre-warm — call this from /readyz or at boot if cold-start latency matters.
// At MVP we accept cold-start on first /tasks/search call.
export async function preloadEmbedder(): Promise<void> {
  await getEmbedder();
}

export const EMBED_DIMENSIONS = EMBED_DIMS;
