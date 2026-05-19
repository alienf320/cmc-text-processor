import { Component, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService, ProcessResult } from './services/api.service';

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
  showManualTranscript = false;

  textInput = '';
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

  private subs: any[] = [];

  constructor(private api: ApiService, private cdr: ChangeDetectorRef) {
    const host = window.location.hostname;
    if (host !== 'localhost' && host !== '127.0.0.1') {
      this.apiUrl = 'https://cmc-text-processor.onrender.com';
      this.api.setBaseUrl(this.apiUrl);
    }
  }

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
    this.cdr.detectChanges();
  }

  applyApiUrl() {
    this.api.setBaseUrl(this.apiUrl);
    this.cdr.detectChanges();
  }

  processYoutube() {
    if (!this.youtubeUrl) return;
    this.youtubeProcessing = true;
    this.error = null;
    this.outputContent = null;
    this.outputFileName = null;
    this.showManualTranscript = false;
    this.youtubeManualTranscript = '';
    this.cdr.detectChanges();

    this.api.processYoutube(this.youtubeUrl, this.contentType, this.language).subscribe({
      next: (result) => {
        this.outputContent = result.content;
        this.outputFileName = result.fileName;
        this.youtubeProcessing = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        const msg = err.error?.error || err.message || '';
        if (msg.includes('Transcript is disabled') || msg.includes('No transcripts')) {
          this.showManualTranscript = true;
          this.error = 'El video no tiene subtítulos. Pegalos manualmente abajo.';
        } else {
          this.error = msg;
        }
        this.youtubeProcessing = false;
        this.cdr.detectChanges();
      },
    });
  }

  processYoutubeManual() {
    if (!this.youtubeManualTranscript) return;
    this.youtubeProcessing = true;
    this.error = null;
    this.outputContent = null;
    this.outputFileName = null;
    this.cdr.detectChanges();

    this.api.processText(this.contentType, this.language, this.youtubeManualTranscript, '').subscribe({
      next: (result) => {
        this.outputContent = result.content;
        this.outputFileName = result.fileName;
        this.youtubeProcessing = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = err.error?.error || err.message || 'Error al procesar';
        this.youtubeProcessing = false;
        this.cdr.detectChanges();
      },
    });
  }

  processText() {
    if (!this.textInput) return;
    this.textProcessing = true;
    this.error = null;
    this.outputContent = null;
    this.outputFileName = null;
    this.cdr.detectChanges();

    this.api.processText(this.contentType, this.language, this.textInput, '').subscribe({
      next: (result) => {
        this.outputContent = result.content;
        this.outputFileName = result.fileName;
        this.textProcessing = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = err.error?.error || err.message || 'Error al procesar texto';
        this.textProcessing = false;
        this.cdr.detectChanges();
      },
    });
  }

  onFileSelected(event: Event) {
    this.selectedFile = (event.target as HTMLInputElement).files?.[0] || null;
  }

  uploadFile() {
    if (!this.selectedFile) return;
    this.fileProcessing = true;
    this.error = null;
    this.outputContent = null;
    this.outputFileName = null;
    this.cdr.detectChanges();

    const formData = new FormData();
    formData.append('file', this.selectedFile);
    formData.append('contentType', this.contentType);
    formData.append('language', this.language);

    this.api.uploadFile(formData).subscribe({
      next: (result) => {
        this.outputContent = result.content;
        this.outputFileName = result.fileName;
        this.fileProcessing = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = err.error?.error || err.message || 'Error al subir archivo';
        this.fileProcessing = false;
        this.cdr.detectChanges();
      },
    });
  }

  loadResults() {
    this.api.listResults().subscribe({
      next: (result) => {
        this.results = result?.files || [];
        this.cdr.detectChanges();
      },
      error: () => {
        this.error = 'Error al cargar resultados';
        this.cdr.detectChanges();
      },
    });
  }

  selectResult(filename: string) {
    this.selectedResult = filename;
    this.selectedContent = null;
    this.cdr.detectChanges();

    this.api.getResult(filename).subscribe({
      next: (result) => {
        this.selectedContent = result?.content || null;
        this.cdr.detectChanges();
      },
      error: () => {
        this.selectedContent = 'Error al leer el archivo';
        this.cdr.detectChanges();
      },
    });
  }

  analyze() {
    if (!this.analyzeText || !this.analyzeQuestion) return;
    this.analyzeProcessing = true;
    this.analyzeAnswer = '';
    this.error = null;
    this.cdr.detectChanges();

    this.api.analyzeText(this.analyzeText, this.analyzeQuestion).subscribe({
      next: (result) => {
        this.analyzeAnswer = result.answer;
        this.analyzeProcessing = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = err.error?.error || err.message || 'Error al analizar';
        this.analyzeProcessing = false;
        this.cdr.detectChanges();
      },
    });
  }
}
