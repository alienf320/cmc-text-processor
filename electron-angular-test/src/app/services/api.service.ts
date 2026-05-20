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

const WORKER_URL = 'https://youtube-transcript-proxy.aerocmc.workers.dev/';

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

    const workerUrl = `${WORKER_URL}?v=${videoId}`;

    const resp = await fetch(workerUrl);
    const data = await resp.json();

    if (!resp.ok) {
      throw new Error(data.error || 'No se pudo acceder al video o descargar subtítulos');
    }

    if (!data.fullText) {
      throw new Error('El video no tiene subtítulos disponibles');
    }

    return data.fullText;
  }
}
