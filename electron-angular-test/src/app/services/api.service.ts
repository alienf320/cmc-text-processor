import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface ProcessResult {
  success: boolean;
  fileName: string;
  content: string;
}

export interface AnalyzeResult {
  success: boolean;
  answer: string;
  modelUsed: string;
}

export interface ResultsList {
  files: string[];
}

const CORS_PROXY = 'https://corsproxy.io/?url=';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private baseUrl: string;

  constructor(private http: HttpClient) {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      this.baseUrl = 'http://localhost:3000';
    } else {
      this.baseUrl = 'https://cmc-text-processor.onrender.com';
    }
  }

  setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/+$/, '');
  }

  getBaseUrl() {
    return this.baseUrl;
  }

  processText(contentType: string, language: string, text: string, extraPrompt?: string) {
    return this.http.post<ProcessResult>(`${this.baseUrl}/api/process`, {
      text, contentType, language, extraPrompt: extraPrompt || null,
    });
  }

  processYoutube(url: string, contentType: string, language: string, extraPrompt?: string) {
    return this.http.post<ProcessResult>(`${this.baseUrl}/api/youtube`, {
      url, contentType, language, extraPrompt: extraPrompt || null,
    });
  }

  uploadFile(formData: FormData) {
    return this.http.post<ProcessResult>(`${this.baseUrl}/api/upload`, formData);
  }

  analyzeText(text: string, question: string) {
    return this.http.post<AnalyzeResult>(`${this.baseUrl}/api/analyze`, { text, question });
  }

  listResults() {
    return this.http.get<ResultsList>(`${this.baseUrl}/api/results`);
  }

  getResult(filename: string) {
    return this.http.get<ProcessResult>(`${this.baseUrl}/api/results/${filename}`);
  }

  // ===== CLIENT-SIDE YOUTUBE TRANSCRIPT FETCH =====

  private extractVideoId(url: string): string {
    const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/);
    return (match && match[2]?.length === 11) ? match[2] : '';
  }

  async fetchYoutubeTranscript(youtubeUrl: string): Promise<string> {
    const videoId = this.extractVideoId(youtubeUrl);
    if (!videoId) throw new Error('URL de YouTube no válida');

    const proxyUrl = CORS_PROXY + encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`);

    const resp = await fetch(proxyUrl);
    if (!resp.ok) throw new Error('No se pudo acceder al video');

    const html = await resp.text();

    const playerResponse = this.parseYtInitialPlayerResponse(html);
    if (!playerResponse) throw new Error('No se pudo obtener información del video');

    const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!captionTracks || captionTracks.length === 0) {
      throw new Error('El video no tiene subtítulos disponibles');
    }

    const preferredLangs = ['es', 'en', 'pt', 'fr', 'de', 'it'];
    let track = null;
    for (const lang of preferredLangs) {
      track = captionTracks.find((t: any) => t.languageCode === lang);
      if (track) break;
    }
    if (!track) track = captionTracks[0];

    const xmlUrl = CORS_PROXY + encodeURIComponent(track.baseUrl);
    const xmlResp = await fetch(xmlUrl);
    if (!xmlResp.ok) throw new Error('No se pudo descargar la transcripción');

    const xml = await xmlResp.text();

    return this.parseTranscriptXml(xml);
  }

  private parseYtInitialPlayerResponse(html: string): any {
    const startToken = 'ytInitialPlayerResponse = ';
    const startIndex = html.indexOf(startToken);
    if (startIndex === -1) return null;

    const jsonStart = startIndex + startToken.length;
    let depth = 0;
    for (let i = jsonStart; i < html.length; i++) {
      if (html[i] === '{') depth++;
      else if (html[i] === '}') {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(html.slice(jsonStart, i + 1));
          } catch { return null; }
        }
      }
    }
    return null;
  }

  private parseTranscriptXml(xml: string): string {
    const parts: string[] = [];

    const pRegex = /<p\s+t="(\d+)"\s+d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;
    let match;
    while ((match = pRegex.exec(xml)) !== null) {
      const inner = match[3].replace(/<[^>]+>/g, '').trim();
      if (inner) parts.push(this.decodeEntities(inner));
    }

    if (parts.length === 0) {
      const classicRegex = /<text start="([^"]*)" dur="([^"]*)">([^<]*)<\/text>/g;
      while ((match = classicRegex.exec(xml)) !== null) {
        parts.push(this.decodeEntities(match[3]));
      }
    }

    return parts.join(' ');
  }

  private decodeEntities(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
      .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)));
  }
}
