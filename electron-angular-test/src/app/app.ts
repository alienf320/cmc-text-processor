import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './services/api.service';

type View = 'youtube' | 'text' | 'analyze' | 'results' | 'settings';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrls: ['./app.scss'],
  imports: [FormsModule],
})
export class App {
  currentView: View = 'youtube';

  apiUrl = 'http://localhost:3000';

  contentType = 'video';
  language = 'es';

  youtubeUrl = '';
  youtubeProcessing = false;
  youtubeManualTranscript = '';
  youtubeVideoId = '';
  showManualTranscript = false;

  textInput = '';
  textFileName = '';
  textProcessing = false;

  selectedFile: File | null = null;
  fileProcessing = false;

  results: string[] = [];
  selectedResult: string | null = null;
  selectedContent: string | null = null;

  analyzeText = '';
  analyzeQuestion = '';
  analyzeAnswer = '';
  analyzeProcessing = false;

  outputContent: string | null = null;
  outputFileName: string | null = null;
  error: string | null = null;

  constructor(private api: ApiService) {}

  switchView(view: View) {
    this.currentView = view;
    this.error = null;
    this.outputContent = null;
    this.analyzeAnswer = '';
    this.showManualTranscript = false;
    this.youtubeManualTranscript = '';

    if (view === 'results') {
      this.loadResults();
    }
  }

  applyApiUrl() {
    this.api.setBaseUrl(this.apiUrl);
  }

  async processYoutube() {
    if (!this.youtubeUrl) return;
    this.youtubeProcessing = true;
    this.error = null;
    this.outputContent = null;
    this.outputFileName = null;
    this.showManualTranscript = false;
    this.youtubeManualTranscript = '';

    try {
      const result = await firstValueFrom(this.api.processYoutube(this.youtubeUrl, this.contentType, this.language));
      if (result) {
        this.outputContent = result.content;
        this.outputFileName = result.fileName;
      }
    } catch (err: any) {
      const msg = err.error?.error || err.message || '';
      if (msg.includes('Transcript is disabled') || msg.includes('No transcripts')) {
        this.showManualTranscript = true;
        this.youtubeVideoId = this.extractVideoId(this.youtubeUrl);
        this.error = 'El video no tiene subtítulos automáticos. Podés pegarlos manualmente abajo.';
      } else {
        this.error = msg;
      }
    } finally {
      this.youtubeProcessing = false;
    }
  }

  async processYoutubeManual() {
    if (!this.youtubeManualTranscript) return;
    this.youtubeProcessing = true;
    this.error = null;
    this.outputContent = null;
    this.outputFileName = null;

    try {
      const result = await firstValueFrom(this.api.processText(this.contentType, this.language, this.youtubeManualTranscript, ''));

      if (result) {
        this.outputContent = result.content;
        this.outputFileName = result.fileName;
      }
    } catch (err: any) {
      this.error = err.error?.error || err.message || 'Error al procesar';
    } finally {
      this.youtubeProcessing = false;
    }
  }

  extractVideoId(url: string): string {
    const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/);
    return (match && match[2]?.length === 11) ? match[2] : '';
  }

  async processText() {
    if (!this.textInput) return;
    this.textProcessing = true;
    this.error = null;
    this.outputContent = null;
    this.outputFileName = null;

    try {
      const result = await firstValueFrom(this.api.processText(this.contentType, this.language, this.textInput, ''));

      if (result) {
        this.outputContent = result.content;
        this.outputFileName = result.fileName;
      }
    } catch (err: any) {
      this.error = err.error?.error || err.message || 'Error al procesar texto';
    } finally {
      this.textProcessing = false;
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    this.selectedFile = input.files?.[0] || null;
  }

  async uploadFile() {
    if (!this.selectedFile) return;
    this.fileProcessing = true;
    this.error = null;
    this.outputContent = null;
    this.outputFileName = null;

    const formData = new FormData();
    formData.append('file', this.selectedFile);
    formData.append('contentType', this.contentType);
    formData.append('language', this.language);

    try {
      const result = await firstValueFrom(this.api.uploadFile(formData));
      if (result) {
        this.outputContent = result.content;
        this.outputFileName = result.fileName;
      }
    } catch (err: any) {
      this.error = err.error?.error || err.message || 'Error al subir archivo';
    } finally {
      this.fileProcessing = false;
    }
  }

  async loadResults() {
    try {
      const result = await firstValueFrom(this.api.listResults());
      this.results = result?.files || [];
    } catch (err: any) {
      this.error = 'Error al cargar resultados';
    }
  }

  async selectResult(filename: string) {
    this.selectedResult = filename;
    try {
      const result = await firstValueFrom(this.api.getResult(filename));
      this.selectedContent = result?.content || null;
    } catch {
      this.selectedContent = 'Error al leer el archivo';
    }
  }

  async analyze() {
    if (!this.analyzeText || !this.analyzeQuestion) return;
    this.analyzeProcessing = true;
    this.analyzeAnswer = '';
    this.error = null;

    try {
      const result = await firstValueFrom(this.api.analyzeText(this.analyzeText, this.analyzeQuestion));
      if (result) {
        this.analyzeAnswer = result.answer;
      }
    } catch (err: any) {
      this.error = err.error?.error || err.message || 'Error al analizar';
    } finally {
      this.analyzeProcessing = false;
    }
  }
}
