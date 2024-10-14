import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';

export interface TextWithPage {
    text: string;
    pageNumber: number;
}

interface Chunk {
    index: number;
    page: number;
    text: string;
}

export async function recursiveChunkingWithPages(textWithPages: TextWithPage[], chunkSize = 1024, chunkOverlap = 300): Promise<Chunk[]> {
    let allText = "";
    const pageBoundaries: [number, number, number][] = [];
    let currentPosition = 0;

    textWithPages.forEach(({ text, pageNumber }) => {
        allText += text;
        pageBoundaries.push([currentPosition, currentPosition + text.length, pageNumber]);
        currentPosition += text.length;
    });

    const result = new RecursiveCharacterTextSplitter({
        chunkSize,
        chunkOverlap,
        lengthFunction: (text: string) => text.length,
        separators: ["\n\n", "\n", ".", "?", "!", " ", ""],
    }).createDocuments([allText]);

    const chunks = (await result).map((doc: any) => doc.pageContent);
    const chunkPageNumbers: number[] = [];

    chunks.forEach((chunk: string) => {
        const chunkStart = allText.indexOf(chunk);
        const chunkEnd = chunkStart + chunk.length;

        for (const [start, end, pageNumber] of pageBoundaries) {
            if (start <= chunkStart && chunkStart < end || start < chunkEnd && chunkEnd <= end) {
                chunkPageNumbers.push(pageNumber);
                break;
            }
        }
    });

    return chunks.map((chunk, i) => ({
        index: i,
        page: chunkPageNumbers[i],
        text: chunk
    }));
}