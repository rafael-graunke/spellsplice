function makeThrottledFetch(intervalMs: number) {
    let chain = Promise.resolve();
    return function slowFetch(url: string): Promise<Response> {
        const result = chain.then(() => fetch(url));
        chain = result.then(
            () => new Promise<void>((res) => setTimeout(res, intervalMs)),
            () => new Promise<void>((res) => setTimeout(res, intervalMs)),
        );
        return result;
    };
}

export const slowFetch = makeThrottledFetch(500);
