/**
 * 深合并两个对象 —— source 覆盖 target 的同名属性，数组直接替换
 * @param target 目标对象（会被修改并返回）
 * @param source 来源对象
 * @returns 合并后的 target
 */
export function mergeDeep<T extends Record<string, any>>(
    target: T,
    source: Record<string, any>,
): T {
    for (const key of Object.keys(source)) {
        const sourceVal = source[key];
        const targetVal = target[key];
        if (
            typeof sourceVal === "object" &&
            !Array.isArray(sourceVal) &&
            typeof targetVal === "object" &&
            !Array.isArray(targetVal)
        ) {
            mergeDeep(targetVal, sourceVal);
        } else {
            (target as any)[key] = sourceVal;
        }
    }
    return target;
}