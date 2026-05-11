import { Component, HostListener } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class App {
  title = 'electron-angular-test';
  droppedFilePaths: string[] = [];
  isDragging = false;

  @HostListener('dragover', ['$event'])
  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  @HostListener('dragleave', ['$event'])
  public onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  @HostListener('drop', ['$event'])
  public onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        // En Electron (con Chrome local), los objetos File tienen una propiedad 'path' oculta
        const file = files[i] as any;
        const filePath = file.path;
        
        if (filePath) {
          this.droppedFilePaths.push(filePath);
          // Si queremos enviarlo a Node.js:
          if ((window as any).electronAPI) {
            (window as any).electronAPI.onFileDrop(filePath);
          }
        }
      }
    }
  }
  // Phase 3 State
  currentView: 'upload' | 'results' = 'upload';

  // Phase 2 State
  resultsFiles: any[] = [];
  selectedFileContent: string | null = null;
  selectedFileName: string | null = null;

  switchView(view: 'upload' | 'results') {
    this.currentView = view;
  }

  async loadResultsDir() {
    if ((window as any).electronAPI) {
      try {
        this.resultsFiles = await (window as any).electronAPI.readResultsDir();
      } catch (err) {
        console.error('Failed to load results:', err);
      }
    } else {
      console.warn('Electron API not available');
    }
  }

  async loadFileContent(file: any) {
    if ((window as any).electronAPI) {
      try {
        this.selectedFileName = file.name;
        this.selectedFileContent = await (window as any).electronAPI.readMdFile(file.path);
      } catch (err) {
        console.error('Failed to read file:', err);
        this.selectedFileContent = 'Error reading file content';
      }
    }
  }
}
