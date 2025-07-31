class XLTranslatorApp {
  constructor() {
    this.initializeElements();
    this.attachEventListeners();
    this.checkAuthAndConfig();
  }

  initializeElements() {
    this.fileInput = document.getElementById('excelFile');
    this.fileInfo = document.getElementById('fileInfo');
    this.fileName = document.getElementById('fileName');
    this.fileSize = document.getElementById('fileSize');
    this.translateBtn = document.getElementById('translateBtn');
    this.uploadForm = document.getElementById('uploadForm');
    this.progressSection = document.getElementById('progressSection');
    this.resultSection = document.getElementById('resultSection');
    this.progressText = document.getElementById('progressText');
    this.progressFill = document.getElementById('progressFill');
    this.resultContent = document.getElementById('resultContent');
    this.fileDropZone = document.getElementById('fileDropZone');
    this.navActions = document.getElementById('navActions');
    this.browseBtn = document.getElementById('browseBtn');
  }

  attachEventListeners() {
    this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
    this.uploadForm.addEventListener('submit', (e) => this.handleFormSubmit(e));
    
    // Browse button click
    this.browseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.fileInput.click();
    });
    
    // Drag and drop functionality
    this.fileDropZone.addEventListener('dragover', (e) => this.handleDragOver(e));
    this.fileDropZone.addEventListener('dragleave', (e) => this.handleDragLeave(e));
    this.fileDropZone.addEventListener('drop', (e) => this.handleDrop(e));
    
    // Click anywhere on drop zone (except browse button) to trigger file selection
    this.fileDropZone.addEventListener('click', (e) => {
      // Don't trigger if the browse button was clicked
      if (!e.target.closest('.browse-btn')) {
        this.fileInput.click();
      }
    });
  }

  handleDragOver(e) {
    e.preventDefault();
    this.fileDropZone.classList.add('dragover');
  }

  handleDragLeave(e) {
    e.preventDefault();
    this.fileDropZone.classList.remove('dragover');
  }

  handleDrop(e) {
    e.preventDefault();
    this.fileDropZone.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      this.fileInput.files = files;
      this.handleFileSelect({ target: { files } });
    }
  }

  handleFileSelect(e) {
    if (e.target.files.length > 0) {
      const file = e.target.files[0];
      this.fileName.textContent = file.name;
      this.fileSize.textContent = `${(file.size / 1024 / 1024).toFixed(2)} MB`;
      this.fileInfo.style.display = 'block';
      this.translateBtn.disabled = false;
    } else {
      this.fileInfo.style.display = 'none';
      this.translateBtn.disabled = true;
    }
  }

  async handleFormSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData();
    formData.append('excelFile', this.fileInput.files[0]);
    
    this.showProgress();
    this.translateBtn.disabled = true;
    
    const progressInterval = this.startProgressAnimation();

    try {
      this.progressText.textContent = 'Uploading file...';
      
      const response = await fetch('/api/translate', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      
      this.stopProgressAnimation(progressInterval);
      this.showResult(result, response.ok);

    } catch (error) {
      this.stopProgressAnimation(progressInterval);
      this.showResult({ error: 'Connection error: ' + error.message }, false);
    }
    
    this.translateBtn.disabled = false;
  }

  showProgress() {
    this.progressSection.style.display = 'block';
    this.resultSection.style.display = 'none';
  }

  startProgressAnimation() {
    let progress = 0;
    return setInterval(() => {
      progress += Math.random() * 15;
      if (progress > 90) progress = 90;
      this.progressFill.style.width = progress + '%';
    }, 500);
  }

  stopProgressAnimation(interval) {
    clearInterval(interval);
    this.progressFill.style.width = '100%';
    
    setTimeout(() => {
      this.progressSection.style.display = 'none';
    }, 500);
  }

  showResult(result, success) {
    this.resultSection.style.display = 'block';
    
    if (success && result.success) {
      this.resultContent.innerHTML = `
        <div class="success">
          <h3><i class="fas fa-check-circle"></i> Translation completed successfully!</h3>
          <p>Your Excel file has been translated and is ready for download.</p>
          <a href="${result.downloadUrl}" class="download-btn">
            <i class="fas fa-download"></i>
            Download Translated File
          </a>
          <div class="stats">
            <h4><i class="fas fa-chart-bar"></i> Translation Statistics</h4>
            <p><strong>Source Column:</strong> ${result.stats.sourceColumn}</p>
            <p><strong>Target Columns:</strong> ${result.stats.targetColumns.join(', ')}</p>
            <p><strong>Texts Found:</strong> ${result.stats.textsFound}</p>
            <p><strong>Translations Applied:</strong> ${result.stats.translationsApplied}</p>
          </div>
        </div>
      `;
    } else {
      this.resultContent.innerHTML = `
        <div class="error">
          <h3><i class="fas fa-exclamation-triangle"></i> Error processing file</h3>
          <p>${result.error || 'Unknown error occurred'}</p>
          ${result.details ? `<p><small><strong>Details:</strong> ${result.details}</small></p>` : ''}
          <button class="browse-btn" onclick="location.reload()">
            <i class="fas fa-redo"></i>
            Try Again
          </button>
        </div>
      `;
    }
  }

  async checkAuthAndConfig() {
    try {
      const authResponse = await fetch('/api/auth/user');
      const authResult = await authResponse.json();
      
      if (!authResult.authenticated) {
        this.showLoginRequired();
        return;
      }
      
      const testResponse = await fetch('/api/test');
      const testResult = await testResponse.json();
      
      if (!testResult.success) {
        this.showConfigError(testResult.error);
      } else {
        this.showWelcome(authResult.user);
      }
    } catch (error) {
      // Silent fail - might be network issue
    }
  }

  showLoginRequired() {
    this.navActions.innerHTML = `
      <a href="/login" class="login-btn">
        <i class="fas fa-sign-in-alt"></i>
        Login
      </a>
    `;
    
    this.resultSection.style.display = 'block';
    this.resultContent.innerHTML = `
      <div class="login-required">
        <h3><i class="fas fa-lock"></i> Authentication Required</h3>
        <p>Please login with your Auth0 account to use the Excel Translator</p>
        <a href="/login" class="login-btn">
          <i class="fas fa-sign-in-alt"></i>
          Login with Auth0
        </a>
      </div>
    `;
    this.uploadForm.style.display = 'none';
  }

  showConfigError(error) {
    this.resultSection.style.display = 'block';
    this.resultContent.innerHTML = `
      <div class="error">
        <h3><i class="fas fa-exclamation-triangle"></i> Configuration Issue</h3>
        <p>${error}</p>
        <p><small>Please check your .env file and restart the application</small></p>
      </div>
    `;
  }

  showWelcome(user) {
    this.navActions.innerHTML = `
      <div class="user-info">
        <span>Welcome, ${user.name || user.email}!</span>
        <a href="/logout" class="logout-btn">
          <i class="fas fa-sign-out-alt"></i>
          Logout
        </a>
      </div>
    `;
    
    this.resultSection.style.display = 'block';
    this.resultContent.innerHTML = `
      <div class="success">
        <h3><i class="fas fa-check-circle"></i> Ready to translate!</h3>
        <p>Upload your Excel file below to get started with AI-powered translation.</p>
      </div>
    `;
  }
}

// Global function for removing files
function removeFile() {
  const fileInput = document.getElementById('excelFile');
  const fileInfo = document.getElementById('fileInfo');
  const translateBtn = document.getElementById('translateBtn');
  
  fileInput.value = '';
  fileInfo.style.display = 'none';
  translateBtn.disabled = true;
}

document.addEventListener('DOMContentLoaded', () => {
  new XLTranslatorApp();
});