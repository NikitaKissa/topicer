export function parseTopics(text: string): string[] {
    return text
        .replace(/^\uFEFF/, "")
        .split(/\r?\n/)
        .map((line) => line.replace(/\s+/g, " ").trim())
        .filter((line) => line.length > 0);
}

export async function loadTopics(url: string): Promise<string[]> {
    let response: Response;
    try {
        response = await fetch(url, { cache: "no-cache" });
    } catch {
        throw new Error("Не вдалось завантажити список тем. Відкрийте сайт через локальний сервер, а не як файл.");
    }
    if (!response.ok) {
        throw new Error(`Не вдалось завантажити список тем (помилка ${response.status}).`);
    }
    return parseTopics(await response.text());
}
