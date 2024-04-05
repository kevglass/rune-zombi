import { ModelRef, loadModel } from "./modelLoader";
import { townModelMapping } from "./townGenerator";

const townModels: Record<string, ModelRef> = {};

export function loadAllTownModels(): void {
    for (const ref of Object.values(townModelMapping)) {
        townModels[ref] = loadModel(ref, true, true);
    }
}

export function getTownModel(ref: string): ModelRef {
    return townModels[ref];
}