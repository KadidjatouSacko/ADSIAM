// Formation Player JavaScript
class FormationPlayer {
    constructor() {
        this.currentVideo = null;
        this.currentQuiz = null;
        this.quizData = null;
        this.currentQuestionIndex = 0;
        this.userAnswers = [];
        this.startTime = Date.now();
        this.timeSpent = 0;
        this.quizTimer = null;
        this.autoSaveInterval = null;

        this.init();
    }

    init() {
        this.initVideoPlayer();
        this.initQuiz();
        this.initAutoSave();
        this.initKeyboardShortcuts();
        this.trackProgress();
    }

    // === VIDEO PLAYER ===
    initVideoPlayer() {
        this.currentVideo = document.getElementById('mainVideo');
        if (!this.currentVideo) return;

        this.currentVideo.addEventListener('play', () => {
            this.hideVideoOverlay();
            this.trackVideoStart();
        });

        this.currentVideo.addEventListener('pause', () => {
            this.trackVideoPause();
        });

        this.currentVideo.addEventListener('ended', () => {
            this.handleVideoEnd();
        });

        this.currentVideo.addEventListener('timeupdate', () => {
            this.trackVideoProgress();
        });

        // Empêcher le clic droit sur la vidéo
        this.currentVideo.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }

    playVideo() {
        if (this.currentVideo) {
            this.currentVideo.play();
        }
    }

    hideVideoOverlay() {
        const overlay = document.getElementById('videoOverlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
    }

    toggleSpeed() {
        if (!this.currentVideo) return;

        const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
        const currentSpeed = this.currentVideo.playbackRate;
        const currentIndex = speeds.indexOf(currentSpeed);
        const nextIndex = (currentIndex + 1) % speeds.length;

        this.currentVideo.playbackRate = speeds[nextIndex];
        document.getElementById('speedText').textContent = speeds[nextIndex] + 'x';
    }

    toggleCaptions() {
        if (!this.currentVideo) return;

        const tracks = this.currentVideo.textTracks;
        if (tracks.length > 0) {
            const track = tracks[0];
            track.mode = track.mode === 'showing' ? 'hidden' : 'showing';
        }
    }

    toggleFullscreen() {
        if (!this.currentVideo) return;

        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            this.currentVideo.requestFullscreen().catch(err => {
                console.log('Erreur fullscreen:', err);
            });
        }
    }

    trackVideoStart() {
        this.sendProgressUpdate('video_start', {
            elementId: formationData.elementId,
            timestamp: this.currentVideo.currentTime
        });
    }

    trackVideoPause() {
        this.sendProgressUpdate('video_pause', {
            elementId: formationData.elementId,
            timestamp: this.currentVideo.currentTime
        });
    }

    trackVideoProgress() {
        const video = this.currentVideo;
        const progressPercent = (video.currentTime / video.duration) * 100;

        // Marquer comme vu à 80%
        if (progressPercent >= 80) {
            this.markElementCompleted();
        }
    }

    handleVideoEnd() {
        this.markElementCompleted();
        this.showNextElementSuggestion();
    }

    // === QUIZ SYSTEM ===
    initQuiz() {
        // Charger les données du quiz depuis le serveur ou les données embarquées
        this.loadQuizData();

        if (this.quizData && this.quizData.questions) {
            this.renderCurrentQuestion();
            this.startQuizTimer();
        }
    }

    loadQuizData() {
        // Simuler des données de quiz (à remplacer par un appel API)
        this.quizData = {
            questions: [
                {
                    id: 1,
                    question: "Quelle est la première étape pour maintenir l'hygiène chez une personne âgée ?",
                    type: "multiple",
                    answers: [
                        { id: 1, text: "Se laver les mains", correct: true },
                        { id: 2, text: "Mettre des gants", correct: false },
                        { id: 3, text: "Préparer le matériel", correct: false },
                        { id: 4, text: "Vérifier la température", correct: false }
                    ]
                },
                {
                    id: 2,
                    question: "À quelle fréquence faut-il changer les draps d'une personne alitée ?",
                    type: "multiple",
                    answers: [
                        { id: 1, text: "Tous les jours", correct: false },
                        { id: 2, text: "Tous les 2-3 jours ou dès qu'ils sont souillés", correct: true },
                        { id: 3, text: "Une fois par semaine", correct: false },
                        { id: 4, text: "Seulement s'ils sont visiblement sales", correct: false }
                    ]
                },
                {
                    id: 3,
                    question: "Comment doit-on procéder pour la toilette au lit ?",
                    type: "multiple",
                    answers: [
                        { id: 1, text: "De haut en bas, du plus propre vers le plus sale", correct: true },
                        { id: 2, text: "De bas en haut, des pieds vers la tête", correct: false },
                        { id: 3, text: "Par zones selon les préférences", correct: false },
                        { id: 4, text: "Tout le corps en même temps", correct: false }
                    ]
                }
            ],
            timeLimit: 300, // 5 minutes
            passingScore: 70
        };
    }

    renderCurrentQuestion() {
        const question = this.quizData.questions[this.currentQuestionIndex];
        if (!question) return;

        const quizContent = document.getElementById('quizContent');
        if (!quizContent) return;

        quizContent.innerHTML = `
            <div class="question">
                <h3>${question.question}</h3>
                <div class="answers">
                    ${question.answers.map(answer => `
                        <div class="answer" onclick="selectAnswer(${answer.id})">
                            <input type="radio" name="question_${question.id}" value="${answer.id}" id="answer_${answer.id}">
                            <label for="answer_${answer.id}">${answer.text}</label>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        this.updateQuizNavigation();
        this.updateQuestionCounter();
    }

    selectAnswer(answerId) {
        // Désélectionner toutes les réponses
        document.querySelectorAll('.answer').forEach(el => {
            el.classList.remove('selected');
        });

        // Sélectionner la réponse cliquée
        const selectedAnswer = document.querySelector(`#answer_${answerId}`).parentElement;
        selectedAnswer.classList.add('selected');

        // Cocher le radio
        document.querySelector(`#answer_${answerId}`).checked = true;

        // Sauvegarder la réponse
        this.userAnswers[this.currentQuestionIndex] = answerId;
    }

    nextQuestion() {
        if (this.currentQuestionIndex < this.quizData.questions.length - 1) {
            this.currentQuestionIndex++;
            this.renderCurrentQuestion();
        }
    }

    previousQuestion() {
        if (this.currentQuestionIndex > 0) {
            this.currentQuestionIndex--;
            this.renderCurrentQuestion();
        }
    }

    updateQuizNavigation() {
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        const submitBtn = document.getElementById('submitBtn');

        if (prevBtn) {
            prevBtn.disabled = this.currentQuestionIndex === 0;
        }

        if (this.currentQuestionIndex === this.quizData.questions.length - 1) {
            if (nextBtn) nextBtn.style.display = 'none';
            if (submitBtn) submitBtn.style.display = 'inline-flex';
        } else {
            if (nextBtn) nextBtn.style.display = 'inline-flex';
            if (submitBtn) submitBtn.style.display = 'none';
        }
    }

    updateQuestionCounter() {
        const currentElement = document.getElementById('currentQuestion');
        const totalElement = document.getElementById('totalQuestions');

        if (currentElement) {
            currentElement.textContent = this.currentQuestionIndex + 1;
        }
        if (totalElement) {
            totalElement.textContent = this.quizData.questions.length;
        }
    }

    startQuizTimer() {
        let timeLeft = this.quizData.timeLimit;
        const timerElement = document.getElementById('timeLeft');

        this.quizTimer = setInterval(() => {
            timeLeft--;

            if (timerElement) {
                const minutes = Math.floor(timeLeft / 60);
                const seconds = timeLeft % 60;
                timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }

            if (timeLeft <= 0) {
                this.submitQuiz(true); // Auto-submit quand le temps est écoulé
            }
        }, 1000);
    }

    submitQuiz(autoSubmit = false) {
        if (this.quizTimer) {
            clearInterval(this.quizTimer);
        }

        const score = this.calculateScore();
        const passed = score >= this.quizData.passingScore;

        this.showQuizResults(score, passed, autoSubmit);

        // Envoyer les résultats au serveur
        this.sendQuizResults(score, passed, this.userAnswers);
    }

    calculateScore() {
        let correctAnswers = 0;

        this.quizData.questions.forEach((question, index) => {
            const userAnswer = this.userAnswers[index];
            const correctAnswer = question.answers.find(a => a.correct);

            if (userAnswer === correctAnswer.id) {
                correctAnswers++;
            }
        });

        return Math.round((correctAnswers / this.quizData.questions.length) * 100);
    }

    showQuizResults(score, passed, autoSubmit) {
        const quizContainer = document.getElementById('quizContainer');

        quizContainer.innerHTML = `
            <div class="quiz-results">
                <div class="results-header">
                    <h2>Résultats du quiz</h2>
                    ${autoSubmit ? '<p class="auto-submit">Quiz soumis automatiquement (temps écoulé)</p>' : ''}
                </div>

                <div class="score-display">
                    <div class="score-circle ${passed ? 'passed' : 'failed'}">
                        <span class="score-number">${score}%</span>
                        <span class="score-label">${passed ? 'Réussi' : 'Échec'}</span>
                    </div>

                    <div class="score-details">
                        <p>Score requis: ${this.quizData.passingScore}%</p>
                        <p>Votre score: ${score}%</p>
                        <p class="status ${passed ? 'success' : 'error'}">
                            ${passed ? 'Félicitations ! Vous avez réussi le quiz.' : 'Vous devez obtenir au moins ' + this.quizData.passingScore + '% pour valider ce module.'}
                        </p>
                    </div>
                </div>

                <div class="results-actions">
                    ${!passed ? `
                        <button class="btn btn-primary" onclick="retryQuiz()">
                            <i class="fas fa-redo"></i>
                            Reprendre le quiz
                        </button>
                    ` : ''}
                    <button class="btn btn-secondary" onclick="showQuizReview()">
                        <i class="fas fa-eye"></i>
                        Voir les réponses
                    </button>
                    ${passed ? `
                        <button class="btn btn-success" onclick="continueToNext()">
                            <i class="fas fa-arrow-right"></i>
                            Continuer
                        </button>
                    ` : ''}
                </div>
            </div>
        `;

        if (passed) {
            this.markElementCompleted();
        }
    }

    retryQuiz() {
        this.currentQuestionIndex = 0;
        this.userAnswers = [];
        this.initQuiz();
    }

    showQuizReview() {
        const reviewContent = this.generateQuizReview();
        this.showModal('Quiz Review', reviewContent);
    }

    generateQuizReview() {
        return this.quizData.questions.map((question, index) => {
            const userAnswer = this.userAnswers[index];
            const correctAnswer = question.answers.find(a => a.correct);
            const userAnswerText = question.answers.find(a => a.id === userAnswer)?.text || 'Aucune réponse';
            const isCorrect = userAnswer === correctAnswer.id;

            return `
                <div class="review-question">
                    <h4>Question ${index + 1}: ${question.question}</h4>
                    <div class="review-answers">
                        <div class="user-answer ${isCorrect ? 'correct' : 'incorrect'}">
                            <strong>Votre réponse:</strong> ${userAnswerText}
                            ${isCorrect ? '<i class="fas fa-check"></i>' : '<i class="fas fa-times"></i>'}
                        </div>
                        ${!isCorrect ? `
                            <div class="correct-answer">
                                <strong>Bonne réponse:</strong> ${correctAnswer.text}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    // === NAVIGATION ET PROGRESSION ===
    loadModule(moduleId) {
        if (moduleId === formationData.moduleId) return;

        window.location.href = `/formation/${formationData.id}/continuer?module=${moduleId}`;
    }

    loadElement(elementId) {
        window.location.href = `/formation/${formationData.id}/continuer?element=${elementId}`;
    }

    markElementCompleted() {
        this.sendProgressUpdate('element_completed', {
            elementId: formationData.elementId,
            timeSpent: this.getTimeSpent()
        });
    }

    completeModule() {
        const confirmation = confirm('Êtes-vous sûr de vouloir terminer ce module ?');
        if (confirmation) {
            this.sendProgressUpdate('module_completed', {
                moduleId: formationData.moduleId,
                timeSpent: this.getTimeSpent()
            });

            // Rediriger vers le module suivant ou le dashboard
            setTimeout(() => {
                window.location.href = `/formation/${formationData.id}/continuer`;
            }, 1000);
        }
    }

    continueToNext() {
        const nextElement = document.querySelector('.nav-right .btn-primary, .nav-right .btn-success');
        if (nextElement) {
            nextElement.click();
        }
    }

    // === DOCUMENTS ===
    showDocuments() {
        this.showModal('documentsModal');
    }

    downloadDocument(url) {
        const link = document.createElement('a');
        link.href = url;
        link.download = url.split('/').pop();
        link.click();
    }

    viewDocument(url) {
        window.open(url, '_blank');
    }

    printDocument() {
        window.print();
    }

    // === NOTES ===
    showNotes() {
        this.showModal('notesModal');
    }

    saveNotes() {
        const notes = document.getElementById('notesTextarea').value;

        fetch('/api/formation/save-notes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                formationId: formationData.id,
                moduleId: formationData.moduleId,
                notes: notes
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                this.showNotification('Notes sauvegardées !', 'success');
            } else {
                this.showNotification('Erreur lors de la sauvegarde', 'error');
            }
        })
        .catch(error => {
            console.error('Erreur sauvegarde notes:', error);
            this.showNotification('Erreur lors de la sauvegarde', 'error');
        });
    }

    exportNotes() {
        const notes = document.getElementById('notesTextarea').value;

        if (!notes.trim()) {
            this.showNotification('Aucune note à exporter', 'warning');
            return;
        }

        // Créer un PDF simple (simulation)
        const content = `
            Formation: ${document.querySelector('.formation-info h1').textContent}
            Module: ${document.querySelector('.content-header h2')?.textContent || 'Module actuel'}
            Date: ${new Date().toLocaleDateString('fr-FR')}

            Notes:
            ${notes}
        `;

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'mes-notes-formation.txt';
        link.click();
        URL.revokeObjectURL(url);
    }

    // === SIDEBAR ===
    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('open');
    }

    // === MODALS ===
    showModal(modalId, content = null) {
        const modal = document.getElementById(modalId);
        if (modal) {
            if (content) {
                const modalBody = modal.querySelector('.modal-body');
                if (modalBody) {
                    modalBody.innerHTML = content;
                }
            }
            modal.classList.add('show');
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('show');
        }
    }

    // === TRACKING ET SAUVEGARDE ===
    trackProgress() {
        this.autoSaveInterval = setInterval(() => {
            this.sendProgressUpdate('progress_update', {
                timeSpent: this.getTimeSpent(),
                currentElement: formationData.elementId
            });
        }, 30000); // Toutes les 30 secondes
    }

    trackTime() {
        // Fonction de tracking du temps passé
        const timeInterval = setInterval(() => {
            this.timeSpent = this.getTimeSpent();

            // Mettre à jour l'affichage du temps si présent
            const timeDisplay = document.getElementById('timeSpent');
            if (timeDisplay) {
                const hours = Math.floor(this.timeSpent / 3600);
                const minutes = Math.floor((this.timeSpent % 3600) / 60);
                const seconds = this.timeSpent % 60;

                if (hours > 0) {
                    timeDisplay.textContent = `${hours}h ${minutes}min ${seconds}s`;
                } else if (minutes > 0) {
                    timeDisplay.textContent = `${minutes}min ${seconds}s`;
                } else {
                    timeDisplay.textContent = `${seconds}s`;
                }
            }
        }, 1000);

        // Nettoyer l'intervalle quand on quitte la page
        window.addEventListener('beforeunload', () => {
            clearInterval(timeInterval);
        });

        return timeInterval;
    }

    initAutoSave() {
        // Sauvegarder automatiquement les notes
        const notesTextarea = document.getElementById('notesTextarea');
        if (notesTextarea) {
            let saveTimeout;
            notesTextarea.addEventListener('input', () => {
                clearTimeout(saveTimeout);
                saveTimeout = setTimeout(() => {
                    this.autoSaveNotes();
                }, 2000);
            });
        }
    }

    autoSaveNotes() {
        const notes = document.getElementById('notesTextarea')?.value;
        if (notes) {
            localStorage.setItem(`notes_${formationData.id}_${formationData.moduleId}`, notes);
        }
    }

    getTimeSpent() {
        return Math.floor((Date.now() - this.startTime) / 1000);
    }

    sendProgressUpdate(action, data) {
        fetch('/api/formation/progress', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action,
                formationId: formationData.id,
                moduleId: formationData.moduleId,
                userId: formationData.userId,
                ...data
            })
        })
        .catch(error => {
            console.error('Erreur mise à jour progression:', error);
        });
    }

    sendQuizResults(score, passed, answers) {
        fetch('/api/formation/quiz-results', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                formationId: formationData.id,
                moduleId: formationData.moduleId,
                elementId: formationData.elementId,
                score,
                passed,
                answers,
                timeSpent: this.getTimeSpent()
            })
        })
        .catch(error => {
            console.error('Erreur sauvegarde quiz:', error);
        });
    }

    // === RACCOURCIS CLAVIER ===
    initKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Espacebar pour play/pause video
            if (e.code === 'Space' && this.currentVideo && e.target.tagName !== 'TEXTAREA') {
                e.preventDefault();
                if (this.currentVideo.paused) {
                    this.currentVideo.play();
                } else {
                    this.currentVideo.pause();
                }
            }

            // Flèches pour navigation
            if (e.code === 'ArrowLeft' && e.ctrlKey) {
                e.preventDefault();
                this.previousQuestion();
            }

            if (e.code === 'ArrowRight' && e.ctrlKey) {
                e.preventDefault();
                this.nextQuestion();
            }

            // Echap pour fermer les modals
            if (e.code === 'Escape') {
                document.querySelectorAll('.modal.show').forEach(modal => {
                    modal.classList.remove('show');
                });
            }
        });
    }

    // === NOTIFICATIONS ===
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    // === AUTRES FONCTIONS ===
    goBack() {
        window.history.back();
    }

    showNextElementSuggestion() {
        const nextBtn = document.querySelector('.nav-right .btn');
        if (nextBtn) {
            nextBtn.style.animation = 'pulse 2s infinite';
            setTimeout(() => {
                nextBtn.style.animation = '';
            }, 6000);
        }
    }
}

// Fonctions globales pour l'interface
let formationPlayer;

function initFormationPlayer() {
    formationPlayer = new FormationPlayer();
}

function selectAnswer(answerId) {
    formationPlayer.selectAnswer(answerId);
}

function nextQuestion() {
    formationPlayer.nextQuestion();
}

function previousQuestion() {
    formationPlayer.previousQuestion();
}

function submitQuiz() {
    formationPlayer.submitQuiz();
}

function retryQuiz() {
    formationPlayer.retryQuiz();
}

function showQuizReview() {
    formationPlayer.showQuizReview();
}

function continueToNext() {
    formationPlayer.continueToNext();
}

function loadModule(moduleId) {
    formationPlayer.loadModule(moduleId);
}

function loadElement(elementId) {
    formationPlayer.loadElement(elementId);
}

function completeModule() {
    formationPlayer.completeModule();
}

function showDocuments() {
    formationPlayer.showDocuments();
}

function showNotes() {
    formationPlayer.showNotes();
}

function saveNotes() {
    formationPlayer.saveNotes();
}

function exportNotes() {
    formationPlayer.exportNotes();
}

function downloadDocument(url) {
    formationPlayer.downloadDocument(url);
}

function viewDocument(url) {
    formationPlayer.viewDocument(url);
}

function printDocument() {
    formationPlayer.printDocument();
}

function toggleSidebar() {
    formationPlayer.toggleSidebar();
}

function closeModal(modalId) {
    formationPlayer.closeModal(modalId);
}

function goBack() {
    formationPlayer.goBack();
}

function playVideo() {
    formationPlayer.playVideo();
}

function toggleSpeed() {
    formationPlayer.toggleSpeed();
}

function toggleCaptions() {
    formationPlayer.toggleCaptions();
}

function toggleFullscreen() {
    formationPlayer.toggleFullscreen();
}

function trackTime() {
    if (formationPlayer) {
        return formationPlayer.trackTime();
    }
}

// Gestionnaire d'événements pour les modals
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('show');
    }
});

// CSS pour les notifications (injection dynamique)
const notificationStyles = `
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        max-width: 300px;
        border-radius: 8px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        animation: slideInRight 0.3s ease;
    }

    .notification.success {
        background: #d4edda;
        color: #155724;
        border: 1px solid #c3e6cb;
    }

    .notification.error {
        background: #f8d7da;
        color: #721c24;
        border: 1px solid #f5c6cb;
    }

    .notification.warning {
        background: #fff3cd;
        color: #856404;
        border: 1px solid #ffeaa7;
    }

    .notification.info {
        background: #d1ecf1;
        color: #0c5460;
        border: 1px solid #bee5eb;
    }

    .notification-content {
        padding: 1rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .notification button {
        background: none;
        border: none;
        font-size: 1.2rem;
        cursor: pointer;
        padding: 0;
        margin-left: 1rem;
        opacity: 0.7;
    }

    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.05); }
        100% { transform: scale(1); }
    }
`;

// Injecter les styles
if (!document.getElementById('notification-styles')) {
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = notificationStyles;
    document.head.appendChild(style);
}

// === FONCTIONS POUR LE MODE REVOIR ===

function refaireFormation() {
    const confirmation = confirm('Êtes-vous sûr de vouloir recommencer cette formation ? Votre progression actuelle sera réinitialisée.');
    if (confirmation) {
        // Rediriger vers le mode continuer pour recommencer
        window.location.href = `/formation/${formationData.id}/continuer?restart=true`;
    }
}

function telechargerCertificat() {
    // Vérifier si l'utilisateur peut télécharger le certificat
    fetch(`/api/formation/${formationData.id}/certificat`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        }
    })
    .then(response => {
        if (response.ok) {
            return response.blob();
        } else {
            throw new Error('Certificat non disponible');
        }
    })
    .then(blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `certificat-formation-${formationData.id}.pdf`;
        link.click();
        URL.revokeObjectURL(url);
    })
    .catch(error => {
        console.error('Erreur téléchargement certificat:', error);
        if (formationPlayer) {
            formationPlayer.showNotification('Certificat non disponible. Assurez-vous d\'avoir terminé la formation avec succès.', 'error');
        } else {
            alert('Certificat non disponible. Assurez-vous d\'avoir terminé la formation avec succès.');
        }
    });
}

function exporterResultats() {
    // Récupérer les données de résultats depuis la page
    const resultatsElements = document.querySelectorAll('.result-card');
    let contenuExport = `Rapport de Formation - ${document.querySelector('.formation-info h1')?.textContent || 'Formation'}\n`;
    contenuExport += `Date d'export: ${new Date().toLocaleDateString('fr-FR')}\n`;
    contenuExport += `=================================\n\n`;

    // Score global
    const scoreGlobal = document.querySelector('.score-value')?.textContent || 'N/A';
    contenuExport += `Score Global: ${scoreGlobal}\n\n`;

    // Détails des modules
    const moduleResults = document.querySelectorAll('.module-result');
    if (moduleResults.length > 0) {
        contenuExport += `Résultats par Module:\n`;
        contenuExport += `----------------------\n`;
        moduleResults.forEach(module => {
            const titre = module.querySelector('h4')?.textContent || 'Module';
            const stats = module.querySelectorAll('.stat');
            const score = stats[0]?.textContent?.trim() || 'N/A';
            const temps = stats[1]?.textContent?.trim() || 'N/A';
            contenuExport += `- ${titre}: ${score} (${temps})\n`;
        });
        contenuExport += `\n`;
    }

    // Résultats des quiz
    const quizResults = document.querySelectorAll('.quiz-result');
    if (quizResults.length > 0) {
        contenuExport += `Résultats des Quiz:\n`;
        contenuExport += `-------------------\n`;
        quizResults.forEach(quiz => {
            const titre = quiz.querySelector('h4')?.textContent || 'Quiz';
            const score = quiz.querySelector('.quiz-score')?.textContent || 'N/A';
            const details = Array.from(quiz.querySelectorAll('.quiz-details span')).map(span => span.textContent).join(' - ');
            contenuExport += `- ${titre}: ${score} (${details})\n`;
        });
        contenuExport += `\n`;
    }

    // Recommandations
    const recommendations = document.querySelectorAll('.recommendation span');
    if (recommendations.length > 0) {
        contenuExport += `Recommandations:\n`;
        contenuExport += `----------------\n`;
        recommendations.forEach(rec => {
            contenuExport += `- ${rec.textContent}\n`;
        });
    }

    // Créer et télécharger le fichier
    const blob = new Blob([contenuExport], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `resultats-formation-${formationData.id}-${new Date().toISOString().split('T')[0]}.txt`;
    link.click();
    URL.revokeObjectURL(url);

    if (formationPlayer) {
        formationPlayer.showNotification('Résultats exportés avec succès !', 'success');
    }
}