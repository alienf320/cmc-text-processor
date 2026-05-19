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
      text,
      contentType,
      language,
      extraPrompt: extraPrompt || null,
    });
  }

  processYoutube(url: string, contentType: string, language: string, extraPrompt?: string) {
    return this.http.post<ProcessResult>(`${this.baseUrl}/api/youtube`, {
      url,
      contentType,
      language,
      extraPrompt: extraPrompt || null,
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
}
