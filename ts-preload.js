(function() {
    'use strict';

    // Информация о плагине
    var plugin_info = {
        name: 'TorrServe Smart Preload',
        version: '1.0.0',
        author: 'TorrServe Team',
        description: 'Умная предзагрузка торрентов для плавного просмотра 4K контента'
    };

    console.log('[TorrServe Smart Preload] Загрузка плагина v' + plugin_info.version);

    // Настройки плагина
    var Settings = {
        torrserve_host: Lampa.Storage.get('torrserver_host', 'http://192.168.1.100:8090'),
        auto_calculate: Lampa.Storage.get('smart_preload_auto', true),
        default_percent: Lampa.Storage.get('smart_preload_percent', 50),
        preload_timeout: Lampa.Storage.get('smart_preload_timeout', 30), // минут
        show_notifications: Lampa.Storage.get('smart_preload_notifications', true)
    };

    // API для работы с TorrServe
    var TorrServeAPI = {
        
        // Получить рекомендацию по предзагрузке
        getRecommendation: function(magnet, fileIndex, callback) {
            console.log('[TorrServe API] Запрос рекомендации для:', magnet.substring(0, 50) + '...');
            
            var data = {
                magnet: magnet,
                file_index: fileIndex || 0,
                auto_calculate: true
            };

            Lampa.Utils.request({
                url: Settings.torrserve_host + '/preload/recommend',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                data: JSON.stringify(data),
                timeout: 15000,
                success: function(response) {
                    console.log('[TorrServe API] Рекомендация получена:', response);
                    try {
                        var recommendation = typeof response === 'string' ? JSON.parse(response) : response;
                        callback(null, recommendation);
                    } catch (e) {
                        callback('Ошибка парсинга ответа: ' + e.message);
                    }
                },
                error: function(xhr, status, error) {
                    console.error('[TorrServe API] Ошибка получения рекомендации:', error);
                    callback('Ошибка связи с TorrServe: ' + error);
                }
            });
        },

        // Запустить предзагрузку
        startPreload: function(magnet, fileIndex, options, callback) {
            console.log('[TorrServe API] Запуск предзагрузки для:', magnet.substring(0, 50) + '...');
            
            var data = {
                magnet: magnet,
                file_index: fileIndex || 0,
                auto_calculate: options.auto_calculate || Settings.auto_calculate,
                percent: options.percent || Settings.default_percent,
                priority: 5
            };

            Lampa.Utils.request({
                url: Settings.torrserve_host + '/preload',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                data: JSON.stringify(data),
                timeout: 10000,
                success: function(response) {
                    console.log('[TorrServe API] Предзагрузка запущена:', response);
                    try {
                        var result = typeof response === 'string' ? JSON.parse(response) : response;
                        callback(null, result);
                    } catch (e) {
                        callback('Ошибка парсинга ответа: ' + e.message);
                    }
                },
                error: function(xhr, status, error) {
                    console.error('[TorrServe API] Ошибка запуска предзагрузки:', error);
                    callback('Ошибка связи с TorrServe: ' + error);
                }
            });
        },

        // Получить статус предзагрузки
        getPreloadStatus: function(taskId, callback) {
            Lampa.Utils.request({
                url: Settings.torrserve_host + '/preload/status?task_id=' + taskId,
                method: 'GET',
                timeout: 5000,
                success: function(response) {
                    try {
                        var status = typeof response === 'string' ? JSON.parse(response) : response;
                        callback(null, status);
                    } catch (e) {
                        callback('Ошибка парсинга статуса: ' + e.message);
                    }
                },
                error: function(xhr, status, error) {
                    callback('Ошибка получения статуса: ' + error);
                }
            });
        },

        // Отменить предзагрузку
        cancelPreload: function(taskId, callback) {
            Lampa.Utils.request({
                url: Settings.torrserve_host + '/preload/cancel?task_id=' + taskId,
                method: 'POST',
                timeout: 5000,
                success: function(response) {
                    callback(null, response);
                },
                error: function(xhr, status, error) {
                    callback('Ошибка отмены: ' + error);
                }
            });
        }
    };

    // UI компоненты
    var PreloadUI = {
        
        // Показать диалог выбора: Предзагрузка или Просмотр
        showChoiceDialog: function(torrent, callback) {
            console.log('[PreloadUI] Показываем диалог выбора для:', torrent.title);

            var dialog = $('<div class="preload-choice-dialog"></div>');
            
            var html = `
                <div class="preload-choice-container">
                    <div class="preload-choice-header">
                        <h2>🎬 ${torrent.title}</h2>
                        <p>Что хотите сделать?</p>
                    </div>
                    
                    <div class="preload-choice-buttons">
                        <div class="preload-choice-btn preload-btn" data-action="preload">
                            <div class="choice-icon">⏳</div>
                            <div class="choice-title">Умная предзагрузка</div>
                            <div class="choice-desc">Загрузить часть фильма для плавного просмотра 4K</div>
                        </div>
                        
                        <div class="preload-choice-btn watch-btn" data-action="watch">
                            <div class="choice-icon">▶️</div>
                            <div class="choice-title">Смотреть сейчас</div>
                            <div class="choice-desc">Начать просмотр немедленно</div>
                        </div>
                    </div>
                    
                    <div class="preload-choice-info">
                        <p>💡 Предзагрузка рекомендуется для 4K контента при медленном интернете</p>
                    </div>
                </div>
            `;
            
            dialog.html(html);
            
            // Стили
            var styles = `
                <style>
                .preload-choice-dialog {
                    position: fixed;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0,0,0,0.8);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                }
                .preload-choice-container {
                    background: #1a1a1a;
                    border-radius: 12px;
                    padding: 30px;
                    max-width: 600px;
                    width: 90%;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.5);
                }
                .preload-choice-header h2 {
                    color: #fff;
                    margin: 0 0 10px 0;
                    font-size: 24px;
                    text-align: center;
                }
                .preload-choice-header p {
                    color: #ccc;
                    margin: 0 0 30px 0;
                    text-align: center;
                    font-size: 16px;
                }
                .preload-choice-buttons {
                    display: flex;
                    gap: 20px;
                    margin-bottom: 20px;
                }
                .preload-choice-btn {
                    flex: 1;
                    background: #2a2a2a;
                    border-radius: 8px;
                    padding: 20px;
                    text-align: center;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    border: 2px solid transparent;
                }
                .preload-choice-btn:hover {
                    background: #3a3a3a;
                    border-color: #0078d4;
                    transform: translateY(-2px);
                }
                .preload-choice-btn.preload-btn:hover {
                    border-color: #ff6b35;
                }
                .preload-choice-btn.watch-btn:hover {
                    border-color: #4CAF50;
                }
                .choice-icon {
                    font-size: 32px;
                    margin-bottom: 10px;
                }
                .choice-title {
                    color: #fff;
                    font-size: 18px;
                    font-weight: bold;
                    margin-bottom: 8px;
                }
                .choice-desc {
                    color: #ccc;
                    font-size: 14px;
                    line-height: 1.4;
                }
                .preload-choice-info {
                    text-align: center;
                    color: #999;
                    font-size: 14px;
                    border-top: 1px solid #333;
                    padding-top: 15px;
                }
                </style>
            `;
            
            $('head').append(styles);
            $('body').append(dialog);
            
            // Обработчики событий
            dialog.find('.preload-choice-btn').on('click', function(e) {
                e.preventDefault();
                var action = $(this).data('action');
                dialog.remove();
                callback(action);
            });
            
            // Закрытие по ESC или клику вне диалога
            $(document).on('keydown.preload-choice', function(e) {
                if (e.keyCode === 27) { // ESC
                    dialog.remove();
                    $(document).off('keydown.preload-choice');
                }
            });
            
            dialog.on('click', function(e) {
                if (e.target === dialog[0]) {
                    dialog.remove();
                }
            });
        },

        // Показать экран настройки предзагрузки
        showPreloadSetup: function(torrent, recommendation, callback) {
            console.log('[PreloadUI] Показываем настройку предзагрузки');

            var dialog = $('<div class="preload-setup-dialog"></div>');
            
            var sizeGB = recommendation ? (recommendation.recommended_bytes / (1024*1024*1024)).toFixed(1) : '?';
            var speedMBps = recommendation ? (recommendation.estimated_speed_bps / (1024*1024)).toFixed(1) : '?';
            
            var html = `
                <div class="preload-setup-container">
                    <div class="preload-setup-header">
                        <h2>🧠 Умная предзагрузка</h2>
                        <h3>${torrent.title}</h3>
                    </div>
                    
                    ${recommendation ? `
                    <div class="preload-recommendation">
                        <div class="rec-title">💡 Рекомендация AI:</div>
                        <div class="rec-content">
                            <div class="rec-item">
                                <span class="rec-label">Процент:</span>
                                <span class="rec-value">${recommendation.recommended_percent}% (${sizeGB} ГБ)</span>
                            </div>
                            <div class="rec-item">
                                <span class="rec-label">Скорость:</span>
                                <span class="rec-value">${speedMBps} МБ/с</span>
                            </div>
                            <div class="rec-item">
                                <span class="rec-label">Время предзагрузки:</span>
                                <span class="rec-value">${recommendation.preload_time_minutes} мин</span>
                            </div>
                            <div class="rec-item">
                                <span class="rec-label">Время просмотра:</span>
                                <span class="rec-value">${recommendation.play_time_minutes} мин</span>
                            </div>
                        </div>
                        <div class="rec-reasoning">${recommendation.reasoning}</div>
                    </div>
                    ` : `
                    <div class="preload-loading">
                        <div class="loading-spinner">⏳</div>
                        <div>Анализируем торрент и скорость интернета...</div>
                    </div>
                    `}
                    
                    <div class="preload-options">
                        <label class="preload-option">
                            <input type="radio" name="preload-mode" value="auto" ${Settings.auto_calculate ? 'checked' : ''}>
                            <span>🤖 Автоматический расчет (рекомендуется)</span>
                        </label>
                        <label class="preload-option">
                            <input type="radio" name="preload-mode" value="manual" ${!Settings.auto_calculate ? 'checked' : ''}>
                            <span>⚙️ Ручная настройка</span>
                        </label>
                    </div>
                    
                    <div class="preload-manual-settings" style="${Settings.auto_calculate ? 'display:none' : ''}">
                        <label class="manual-input">
                            <span>Процент предзагрузки:</span>
                            <input type="range" min="10" max="90" value="${Settings.default_percent}" class="percent-slider">
                            <span class="percent-value">${Settings.default_percent}%</span>
                        </label>
                    </div>
                    
                    <div class="preload-buttons">
                        <button class="preload-start-btn">🚀 Начать предзагрузку</button>
                        <button class="preload-cancel-btn">❌ Отмена</button>
                    </div>
                </div>
            `;
            
            dialog.html(html);
            
            // Дополнительные стили
            var setupStyles = `
                <style>
                .preload-setup-dialog {
                    position: fixed;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0,0,0,0.9);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10001;
                }
                .preload-setup-container {
                    background: #1a1a1a;
                    border-radius: 12px;
                    padding: 30px;
                    max-width: 700px;
                    width: 90%;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.7);
                    max-height: 80vh;
                    overflow-y: auto;
                }
                .preload-setup-header h2 {
                    color: #fff;
                    margin: 0 0 5px 0;
                    font-size: 24px;
                    text-align: center;
                }
                .preload-setup-header h3 {
                    color: #ccc;
                    margin: 0 0 25px 0;
                    font-size: 16px;
                    text-align: center;
                    font-weight: normal;
                }
                .preload-recommendation {
                    background: #2a2a2a;
                    border-radius: 8px;
                    padding: 20px;
                    margin-bottom: 20px;
                    border-left: 4px solid #ff6b35;
                }
                .rec-title {
                    color: #ff6b35;
                    font-weight: bold;
                    margin-bottom: 15px;
                    font-size: 16px;
                }
                .rec-content {
                    display: grid;
                    gap: 8px;
                    margin-bottom: 15px;
                }
                .rec-item {
                    display: flex;
                    justify-content: space-between;
                }
                .rec-label {
                    color: #ccc;
                }
                .rec-value {
                    color: #fff;
                    font-weight: bold;
                }
                .rec-reasoning {
                    color: #aaa;
                    font-style: italic;
                    font-size: 14px;
                }
                .preload-loading {
                    text-align: center;
                    padding: 40px;
                    color: #ccc;
                }
                .loading-spinner {
                    font-size: 32px;
                    margin-bottom: 10px;
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .preload-options {
                    margin-bottom: 20px;
                }
                .preload-option {
                    display: block;
                    color: #fff;
                    margin-bottom: 10px;
                    cursor: pointer;
                    padding: 10px;
                    border-radius: 6px;
                    transition: background 0.2s;
                }
                .preload-option:hover {
                    background: #2a2a2a;
                }
                .preload-option input {
                    margin-right: 10px;
                }
                .preload-manual-settings {
                    background: #2a2a2a;
                    border-radius: 8px;
                    padding: 15px;
                    margin-bottom: 20px;
                }
                .manual-input {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                    color: #fff;
                }
                .percent-slider {
                    flex: 1;
                    height: 6px;
                    background: #444;
                    border-radius: 3px;
                    outline: none;
                }
                .percent-value {
                    min-width: 40px;
                    font-weight: bold;
                    color: #ff6b35;
                }
                .preload-buttons {
                    display: flex;
                    gap: 15px;
                    justify-content: center;
                }
                .preload-start-btn, .preload-cancel-btn {
                    padding: 12px 30px;
                    border-radius: 6px;
                    border: none;
                    font-size: 16px;
                    cursor: pointer;
                    transition: all 0.3s;
                }
                .preload-start-btn {
                    background: #4CAF50;
                    color: white;
                }
                .preload-start-btn:hover {
                    background: #45a049;
                    transform: translateY(-1px);
                }
                .preload-cancel-btn {
                    background: #666;
                    color: white;
                }
                .preload-cancel-btn:hover {
                    background: #777;
                }
                </style>
            `;
            
            $('head').append(setupStyles);
            $('body').append(dialog);
            
            // Обработчики событий
            dialog.find('input[name="preload-mode"]').on('change', function() {
                var isManual = $(this).val() === 'manual';
                dialog.find('.preload-manual-settings').toggle(isManual);
                Settings.auto_calculate = !isManual;
                Lampa.Storage.set('smart_preload_auto', Settings.auto_calculate);
            });
            
            dialog.find('.percent-slider').on('input', function() {
                var value = $(this).val();
                dialog.find('.percent-value').text(value + '%');
                Settings.default_percent = parseInt(value);
                Lampa.Storage.set('smart_preload_percent', Settings.default_percent);
            });
            
            dialog.find('.preload-start-btn').on('click', function() {
                var options = {
                    auto_calculate: Settings.auto_calculate,
                    percent: Settings.default_percent
                };
                dialog.remove();
                callback('start', options);
            });
            
            dialog.find('.preload-cancel-btn').on('click', function() {
                dialog.remove();
                callback('cancel');
            });
            
            // Если нет рекомендации, пытаемся её получить
            if (!recommendation) {
                TorrServeAPI.getRecommendation(torrent.magnet, 0, function(error, rec) {
                    if (!error && rec) {
                        // Обновляем диалог с рекомендацией
                        PreloadUI.updateRecommendationInDialog(dialog, rec);
                    } else {
                        console.warn('[PreloadUI] Не удалось получить рекомендацию:', error);
                        dialog.find('.preload-loading').html(`
                            <div style="color: #ff6b35;">⚠️ Не удалось получить рекомендацию</div>
                            <div style="font-size: 14px; margin-top: 10px;">Будет использован ручной режим</div>
                        `);
                    }
                });
            }
        },

        // Обновить рекомендацию в диалоге
        updateRecommendationInDialog: function(dialog, recommendation) {
            var sizeGB = (recommendation.recommended_bytes / (1024*1024*1024)).toFixed(1);
            var speedMBps = (recommendation.estimated_speed_bps / (1024*1024)).toFixed(1);
            
            var recHTML = `
                <div class="preload-recommendation">
                    <div class="rec-title">💡 Рекомендация AI:</div>
                    <div class="rec-content">
                        <div class="rec-item">
                            <span class="rec-label">Процент:</span>
                            <span class="rec-value">${recommendation.recommended_percent}% (${sizeGB} ГБ)</span>
                        </div>
                        <div class="rec-item">
                            <span class="rec-label">Скорость:</span>
                            <span class="rec-value">${speedMBps} МБ/с</span>
                        </div>
                        <div class="rec-item">
                            <span class="rec-label">Время предзагрузки:</span>
                            <span class="rec-value">${recommendation.preload_time_minutes} мин</span>
                        </div>
                        <div class="rec-item">
                            <span class="rec-label">Время просмотра:</span>
                            <span class="rec-value">${recommendation.play_time_minutes} мин</span>
                        </div>
                    </div>
                    <div class="rec-reasoning">${recommendation.reasoning}</div>
                </div>
            `;
            
            dialog.find('.preload-loading').replaceWith(recHTML);
        },

        // Показать экран прогресса предзагрузки
        showPreloadProgress: function(torrent, taskId) {
            console.log('[PreloadUI] Показываем прогресс предзагрузки для задачи:', taskId);

            var dialog = $('<div class="preload-progress-dialog"></div>');
            
            var html = `
                <div class="preload-progress-container">
                    <div class="preload-progress-header">
                        <h2>⏳ Предзагрузка</h2>
                        <h3>${torrent.title}</h3>
                    </div>
                    
                    <div class="preload-progress-content">
                        <div class="progress-main">
                            <div class="progress-circle">
                                <svg class="progress-ring" width="120" height="120">
                                    <circle class="progress-ring-circle" stroke="#ff6b35" stroke-width="6" 
                                            fill="transparent" r="52" cx="60" cy="60"/>
                                </svg>
                                <div class="progress-text">
                                    <span class="progress-percent">0%</span>
                                    <span class="progress-label">готово</span>
                                </div>
                            </div>
                            
                            <div class="progress-info">
                                <div class="info-item">
                                    <span class="info-label">Статус:</span>
                                    <span class="info-value status-text">Инициализация...</span>
                                </div>
                                <div class="info-item">
                                    <span class="info-label">Скорость:</span>
                                    <span class="info-value speed-text">-</span>
                                </div>
                                <div class="info-item">
                                    <span class="info-label">Прогресс:</span>
                                    <span class="info-value progress-text">0 / 0</span>
                                </div>
                                <div class="info-item">
                                    <span class="info-label">ETA:</span>
                                    <span class="info-value eta-text">-</span>
                                </div>
                                <div class="info-item">
                                    <span class="info-label">Пиры:</span>
                                    <span class="info-value peers-text">-</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="preload-actions">
                            <button class="preload-watch-btn" disabled>▶️ Смотреть сейчас</button>
                            <button class="preload-stop-btn">⏹️ Остановить</button>
                        </div>
                        
                        <div class="preload-hint">
                            💡 Когда предзагрузка достигнет достаточного уровня, 
                            кнопка "Смотреть сейчас" станет активной
                        </div>
                    </div>
                </div>
            `;
            
            dialog.html(html);
            
            // Стили прогресса
            var progressStyles = `
                <style>
                .preload-progress-dialog {
                    position: fixed;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0,0,0,0.9);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10002;
                }
                .preload-progress-container {
                    background: #1a1a1a;
                    border-radius: 12px;
                    padding: 30px;
                    max-width: 600px;
                    width: 90%;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.7);
                }
                .preload-progress-header h2 {
                    color: #fff;
                    margin: 0 0 5px 0;
                    font-size: 24px;
                    text-align: center;
                }
                .preload-progress-header h3 {
                    color: #ccc;
                    margin: 0 0 30px 0;
                    font-size: 16px;
                    text-align: center;
                    font-weight: normal;
                }
                .progress-main {
                    display: flex;
                    gap: 30px;
                    align-items: center;
                    margin-bottom: 30px;
                }
                .progress-circle {
                    position: relative;
                    flex-shrink: 0;
                }
                .progress-ring {
                    transform: rotate(-90deg);
                }
                .progress-ring-circle {
                    stroke-dasharray: 326.56;
                    stroke-dashoffset: 326.56;
                    transition: stroke-dashoffset 0.5s ease;
                }
                .progress-text {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    text-align: center;
                }
                .progress-percent {
                    display: block;
                    font-size: 24px;
                    font-weight: bold;
                    color: #ff6b35;
                }
                .progress-label {
                    display: block;
                    font-size: 12px;
                    color: #ccc;
                }
                .progress-info {
                    flex: 1;
                }
                .info-item {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 10px;
                    padding: 8px 0;
                    border-bottom: 1px solid #333;
                }
                .info-label {
                    color: #ccc;
                }
                .info-value {
                    color: #fff;
                    font-weight: bold;
                }
                .preload-actions {
                    display: flex;
                    gap: 15px;
                    justify-content: center;
                    margin-bottom: 20px;
                }
                .preload-watch-btn, .preload-stop-btn {
                    padding: 12px 24px;
                    border-radius: 6px;
                    border: none;
                    font-size: 16px;
                    cursor: pointer;
                    transition: all 0.3s;
                }
                .preload-watch-btn {
                    background: #4CAF50;
                    color: white;
                }
                .preload-watch-btn:disabled {
                    background: #666;
                    cursor: not-allowed;
                    opacity: 0.6;
                }
                .preload-watch-btn:not(:disabled):hover {
                    background: #45a049;
                    transform: translateY(-1px);
                }
                .preload-stop-btn {
                    background: #f44336;
                    color: white;
                }
                .preload-stop-btn:hover {
                    background: #da190b;
                }
                .preload-hint {
                    background: #2a2a2a;
                    border-radius: 6px;
                    padding: 15px;
                    color: #ccc;
                    font-size: 14px;
                    text-align: center;
                    line-height: 1.4;
                }
                .status-ready {
                    color: #4CAF50 !important;
                }
                .status-error {
                    color: #f44336 !important;
                }
                </style>
            `;
            
            $('head').append(progressStyles);
            $('body').append(dialog);
            
            // Запуск мониторинга прогресса
            var progressInterval = setInterval(function() {
                TorrServeAPI.getPreloadStatus(taskId, function(error, status) {
                    if (error) {
                        console.error('[PreloadUI] Ошибка получения статуса:', error);
                        return;
                    }
                    
                    PreloadUI.updateProgressDialog(dialog, status);
                    
                    // Если задача завершена или ошибка, останавливаем мониторинг
                    if (status.state === 'completed' || status.state === 'error' || status.state === 'cancelled') {
                        clearInterval(progressInterval);
                    }
                });
            }, 2000); // Обновляем каждые 2 секунды
            
            // Обработчики кнопок
            dialog.find('.preload-watch-btn').on('click', function() {
                if (!$(this).prop('disabled')) {
                    clearInterval(progressInterval);
                    dialog.remove();
                    // Запускаем просмотр через стандартный механизм Lampa
                    PreloadUI.startWatching(torrent);
                }
            });
            
            dialog.find('.preload-stop-btn').on('click', function() {
                TorrServeAPI.cancelPreload(taskId, function(error) {
                    if (error) {
                        Lampa.Noty.show('Ошибка отмены: ' + error, {type: 'error'});
                    } else {
                        Lampa.Noty.show('Предзагрузка отменена', {type: 'success'});
                    }
                });
                clearInterval(progressInterval);
                dialog.remove();
            });
            
            // Сохраняем ссылки для внешнего управления
            dialog.data('interval', progressInterval);
            dialog.data('taskId', taskId);
            
            return dialog;
        },

        // Обновить диалог прогресса
        updateProgressDialog: function(dialog, status) {
            var percent = 0;
            if (status.target_bytes > 0) {
                percent = Math.round((status.progress_bytes / status.target_bytes) * 100);
            }
            
            // Обновляем круговой прогресс
            var circumference = 326.56;
            var offset = circumference - (percent / 100) * circumference;
            dialog.find('.progress-ring-circle').css('stroke-dashoffset', offset);
            dialog.find('.progress-percent').text(percent + '%');
            
            // Обновляем информацию
            var statusText = PreloadUI.getStatusText(status.state);
            var statusClass = status.state === 'error' ? 'status-error' : 
                            (status.ready ? 'status-ready' : '');
            
            dialog.find('.status-text').text(statusText).attr('class', 'info-value status-text ' + statusClass);
            
            var speedText = status.speed_bps > 0 ? 
                PreloadUI.formatSpeed(status.speed_bps) : '-';
            dialog.find('.speed-text').text(speedText);
            
            var progressText = PreloadUI.formatBytes(status.progress_bytes) + ' / ' + 
                              PreloadUI.formatBytes(status.target_bytes);
            dialog.find('.progress-text').text(progressText);
            
            var etaText = status.eta_seconds > 0 ? 
                PreloadUI.formatTime(status.eta_seconds) : '-';
            dialog.find('.eta-text').text(etaText);
            
            var peersText = status.seeds + ' / ' + status.peers;
            dialog.find('.peers-text').text(peersText);
            
            // Активируем кнопку просмотра при достижении минимального процента
            var minPercent = 25; // Минимум 25% для начала просмотра
            dialog.find('.preload-watch-btn').prop('disabled', percent < minPercent);
            
            // Показываем уведомление о готовности
            if (status.ready && !dialog.data('notified')) {
                dialog.data('notified', true);
                if (Settings.show_notifications) {
                    Lampa.Noty.show('🎬 Предзагрузка завершена! Можно начинать просмотр', {
                        type: 'success', 
                        timeout: 5000
                    });
                }
            }
        },

        // Запуск просмотра
        startWatching: function(torrent) {
            console.log('[PreloadUI] Запуск просмотра:', torrent.title);
            
            // Формируем URL для TorrServe
            var streamUrl = Settings.torrserve_host + '/stream/' + 
                          encodeURIComponent(torrent.title) + 
                          '?link=' + encodeURIComponent(torrent.magnet) + 
                          '&index=0&play';
            
            // Запускаем через стандартный плеер Lampa
            Lampa.Player.play({
                url: streamUrl,
                title: torrent.title,
                quality: torrent.quality || '4K'
            });
            
            Lampa.Player.listener.send('play', {});
        },

        // Вспомогательные функции форматирования
        getStatusText: function(state) {
            var states = {
                'queued': 'В очереди',
                'starting': 'Запуск',
                'getting_info': 'Получение информации',
                'calculating_optimal_size': 'Расчет размера',
                'running': 'Загрузка',
                'completed': 'Завершено',
                'cancelled': 'Отменено',
                'error': 'Ошибка'
            };
            return states[state] || state;
        },

        formatBytes: function(bytes) {
            if (bytes === 0) return '0 B';
            var k = 1024;
            var sizes = ['B', 'КБ', 'МБ', 'ГБ'];
            var i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
        },

        formatSpeed: function(bps) {
            return PreloadUI.formatBytes(bps) + '/с';
        },

        formatTime: function(seconds) {
            if (seconds < 60) return seconds + 'с';
            if (seconds < 3600) return Math.floor(seconds / 60) + 'м ' + (seconds % 60) + 'с';
            return Math.floor(seconds / 3600) + 'ч ' + Math.floor((seconds % 3600) / 60) + 'м';
        }
    };

    // Интеграция с Lampa
    var LampaIntegration = {
        
        // Инициализация плагина
        init: function() {
            console.log('[Lampa Integration] Инициализация плагина');
            
            // Добавляем настройки в меню Lampa
            LampaIntegration.addSettings();
            
            // Перехватываем клики по торрентам
            LampaIntegration.interceptTorrentClicks();
            
            console.log('[Lampa Integration] Плагин инициализирован');
        },

        // Добавление настроек плагина
        addSettings: function() {
            // Добавляем раздел настроек
            Lampa.Settings.listener.follow('open', function(e) {
                if (e.name === 'main') {
                    // Добавляем пункт в главное меню настроек
                    var item = $('<div class="settings-param selector" data-type="toggle" data-name="smart_preload_enabled">' +
                               '<div class="settings-param__name">TorrServe Smart Preload</div>' +
                               '<div class="settings-param__value">Включить умную предзагрузку</div>' +
                               '</div>');
                    
                    $('.settings .settings-param').last().after(item);
                    
                    item.on('click', function() {
                        LampaIntegration.openSettings();
                    });
                }
            });
        },

        // Открытие настроек плагина
        openSettings: function() {
            var modal = $('<div class="smart-preload-settings"></div>');
            
            var html = `
                <div class="smart-preload-settings-container">
                    <div class="settings-header">
                        <h2>⚙️ TorrServe Smart Preload</h2>
                        <button class="settings-close">×</button>
                    </div>
                    
                    <div class="settings-content">
                        <div class="setting-item">
                            <label>🌐 Адрес TorrServe:</label>
                            <input type="text" class="torrserve-host" value="${Settings.torrserve_host}" 
                                   placeholder="http://192.168.1.100:8090">
                        </div>
                        
                        <div class="setting-item">
                            <label>
                                <input type="checkbox" class="auto-calculate" ${Settings.auto_calculate ? 'checked' : ''}>
                                🤖 Автоматический расчет размера предзагрузки
                            </label>
                        </div>
                        
                        <div class="setting-item">
                            <label>📊 Процент предзагрузки по умолчанию:</label>
                            <input type="range" min="10" max="90" value="${Settings.default_percent}" 
                                   class="default-percent">
                            <span class="percent-display">${Settings.default_percent}%</span>
                        </div>
                        
                        <div class="setting-item">
                            <label>⏱️ Таймаут предзагрузки (минуты):</label>
                            <input type="number" min="5" max="120" value="${Settings.preload_timeout}" 
                                   class="preload-timeout">
                        </div>
                        
                        <div class="setting-item">
                            <label>
                                <input type="checkbox" class="show-notifications" ${Settings.show_notifications ? 'checked' : ''}>
                                🔔 Показывать уведомления
                            </label>
                        </div>
                    </div>
                    
                    <div class="settings-footer">
                        <button class="save-settings">💾 Сохранить</button>
                        <button class="test-connection">🔗 Тест соединения</button>
                    </div>
                </div>
            `;
            
            modal.html(html);
            
            // Стили настроек
            var settingsStyles = `
                <style>
                .smart-preload-settings {
                    position: fixed;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0,0,0,0.8);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10003;
                }
                .smart-preload-settings-container {
                    background: #1a1a1a;
                    border-radius: 12px;
                    width: 90%;
                    max-width: 600px;
                    max-height: 80vh;
                    overflow-y: auto;
                }
                .settings-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 20px 30px;
                    border-bottom: 1px solid #333;
                }
                .settings-header h2 {
                    color: #fff;
                    margin: 0;
                    font-size: 20px;
                }
                .settings-close {
                    background: none;
                    border: none;
                    color: #ccc;
                    font-size: 24px;
                    cursor: pointer;
                    padding: 0;
                    width: 30px;
                    height: 30px;
                }
                .settings-content {
                    padding: 20px 30px;
                }
                .setting-item {
                    margin-bottom: 20px;
                }
                .setting-item label {
                    display: block;
                    color: #fff;
                    margin-bottom: 8px;
                    font-weight: bold;
                }
                .setting-item input[type="text"], 
                .setting-item input[type="number"] {
                    width: 100%;
                    padding: 10px;
                    border: 1px solid #555;
                    border-radius: 6px;
                    background: #2a2a2a;
                    color: #fff;
                    font-size: 14px;
                }
                .setting-item input[type="range"] {
                    width: calc(100% - 60px);
                    margin-right: 10px;
                }
                .percent-display {
                    color: #ff6b35;
                    font-weight: bold;
                    min-width: 50px;
                    display: inline-block;
                }
                .setting-item input[type="checkbox"] {
                    margin-right: 10px;
                    transform: scale(1.2);
                }
                .settings-footer {
                    padding: 20px 30px;
                    border-top: 1px solid #333;
                    display: flex;
                    gap: 15px;
                    justify-content: center;
                }
                .save-settings, .test-connection {
                    padding: 10px 20px;
                    border: none;
                    border-radius: 6px;
                    font-size: 14px;
                    cursor: pointer;
                    transition: background 0.3s;
                }
                .save-settings {
                    background: #4CAF50;
                    color: white;
                }
                .save-settings:hover {
                    background: #45a049;
                }
                .test-connection {
                    background: #2196F3;
                    color: white;
                }
                .test-connection:hover {
                    background: #1976D2;
                }
                </style>
            `;
            
            $('head').append(settingsStyles);
            $('body').append(modal);
            
            // Обработчики событий настроек
            modal.find('.settings-close').on('click', function() {
                modal.remove();
            });
            
            modal.find('.default-percent').on('input', function() {
                var value = $(this).val();
                modal.find('.percent-display').text(value + '%');
            });
            
            modal.find('.save-settings').on('click', function() {
                // Сохраняем настройки
                Settings.torrserve_host = modal.find('.torrserve-host').val();
                Settings.auto_calculate = modal.find('.auto-calculate').prop('checked');
                Settings.default_percent = parseInt(modal.find('.default-percent').val());
                Settings.preload_timeout = parseInt(modal.find('.preload-timeout').val());
                Settings.show_notifications = modal.find('.show-notifications').prop('checked');
                
                // Сохраняем в Lampa Storage
                Lampa.Storage.set('torrserver_host', Settings.torrserve_host);
                Lampa.Storage.set('smart_preload_auto', Settings.auto_calculate);
                Lampa.Storage.set('smart_preload_percent', Settings.default_percent);
                Lampa.Storage.set('smart_preload_timeout', Settings.preload_timeout);
                Lampa.Storage.set('smart_preload_notifications', Settings.show_notifications);
                
                Lampa.Noty.show('Настройки сохранены', {type: 'success'});
                modal.remove();
            });
            
            modal.find('.test-connection').on('click', function() {
                var host = modal.find('.torrserve-host').val();
                
                Lampa.Utils.request({
                    url: host + '/echo',
                    timeout: 5000,
                    success: function(response) {
                        Lampa.Noty.show('✅ Соединение с TorrServe установлено!', {type: 'success'});
                    },
                    error: function() {
                        Lampa.Noty.show('❌ Ошибка соединения с TorrServe', {type: 'error'});
                    }
                });
            });
        },

        // Перехват кликов по торрентам
        interceptTorrentClicks: function() {
        // Перехватываем события Lampa для файлов торрентов
        if (window.Lampa && window.Lampa.Listener) {
            console.log('[Lampa Integration] Подключаемся к событиям Lampa');
            
            // Сохраняем ссылку на торрент при его выборе
            var currentTorrentData = null;
            
            window.Lampa.Listener.follow('torrent', function(e) {
                if (e.type === 'onenter') {
                    console.log('[Lampa Integration] Сохраняем данные торрента:', e.element);
                    currentTorrentData = LampaIntegration.extractTorrentDataFromElement(e.element);
                }
            });
            
            // Сохраняем оригинальную функцию Player.play
            if (window.Lampa && window.Lampa.Player && window.Lampa.Player.play) {
                LampaIntegration.originalPlayerPlay = window.Lampa.Player.play;
            }
            
            // Перехватываем выбор файла - это правильное место!
            window.Lampa.Listener.follow('torrent_file', function(e) {
                if (e.type === 'onenter' && currentTorrentData) {
                    console.log('[Lampa Integration] Перехвачен выбор файла:', e.element);
                    
                    // Обогащаем данные информацией о выбранном файле
                    var fileData = {
                        ...currentTorrentData,
                        file_url: e.element.url,
                        file_title: e.element.title,
                        file_size: e.element.size || null,
                        timeline: e.element.timeline || null,
                        element: e.element,
                        item: e.item
                    };
                    
                    // Временно переопределяем Player.play для перехвата
                    if (window.Lampa && window.Lampa.Player) {
                        window.Lampa.Player.play = function(element) {
                            console.log('[Lampa Integration] Перехвачен Player.play, показываем диалог');
                            
                            // Восстанавливаем оригинальную функцию
                            if (LampaIntegration.originalPlayerPlay) {
                                window.Lampa.Player.play = LampaIntegration.originalPlayerPlay;
                            }
                            
                            // Показываем диалог выбора
                            PreloadUI.showChoiceDialog(fileData, function(action) {
                                if (action === 'preload') {
                                    LampaIntegration.handlePreloadChoice(fileData);
                                } else if (action === 'watch') {
                                    LampaIntegration.handleWatchChoice(fileData, element);
                                }
                            });
                        };
                    }
                }
            });
        } else {
            console.warn('[Lampa Integration] Lampa.Listener недоступен, пытаемся перехватить клики');
            
            // Fallback для старых версий
            $(document).on('click', '.torrent-item', function(e) {
                var $this = $(this);
                var torrentData = LampaIntegration.extractTorrentData($this);
                
                if (torrentData && torrentData.magnet) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    PreloadUI.showChoiceDialog(torrentData, function(action) {
                        if (action === 'preload') {
                            LampaIntegration.handlePreloadChoice(torrentData);
                        } else if (action === 'watch') {
                            LampaIntegration.handleWatchChoice(torrentData);
                        }
                    });
                    
                    return false;
                }
            });
        }
        },

        // Извлечение данных торрента из элемента Lampa (новый API)
        extractTorrentDataFromElement: function(element) {
            try {
                if (element && element.MagnetUri) {
                    return {
                        title: element.Title || element.title || 'Неизвестный торрент',
                        magnet: element.MagnetUri,
                        quality: LampaIntegration.detectQuality(element.Title || element.title),
                        size: element.Size || null,
                        seeds: element.Seeders || 0,
                        peers: element.Peers || 0,
                        tracker: element.Tracker || ''
                    };
                }
                
                return null;
            } catch (e) {
                console.warn('[Lampa Integration] Ошибка извлечения данных из элемента Lampa:', e);
                return null;
            }
        },

        // Извлечение данных торрента из элемента DOM (fallback)
        extractTorrentData: function($element) {
            try {
                // Пытаемся найти данные в разных местах
                var data = $element.data('json') || $element.data('torrent') || {};
                
                // Если данных нет, пытаемся извлечь из атрибутов
                if (!data.magnet) {
                    data.magnet = $element.attr('data-magnet') || 
                                 $element.find('[data-magnet]').attr('data-magnet') ||
                                 $element.attr('href');
                }
                
                if (!data.title) {
                    data.title = $element.attr('data-title') || 
                                $element.find('.online__title, .files__title').text() ||
                                $element.text().trim();
                }
                
                // Проверяем что это magnet-ссылка
                if (data.magnet && data.magnet.startsWith('magnet:')) {
                    return {
                        title: data.title || 'Неизвестный торрент',
                        magnet: data.magnet,
                        quality: data.quality || LampaIntegration.detectQuality(data.title),
                        size: data.size || null
                    };
                }
                
                return null;
            } catch (e) {
                console.warn('[Lampa Integration] Ошибка извлечения данных торрента:', e);
                return null;
            }
        },

        // Определение качества по названию
        detectQuality: function(title) {
            if (!title) return '';
            
            title = title.toLowerCase();
            if (title.includes('2160p') || title.includes('4k')) return '4K';
            if (title.includes('1080p')) return '1080p';
            if (title.includes('720p')) return '720p';
            return '';
        },

        // Обработка выбора предзагрузки
        handlePreloadChoice: function(torrentData) {
            console.log('[Lampa Integration] Запуск предзагрузки для:', torrentData.title);
            
            // Сначала получаем рекомендацию
            TorrServeAPI.getRecommendation(torrentData.magnet, 0, function(error, recommendation) {
                // Показываем диалог настройки (с рекомендацией или без)
                PreloadUI.showPreloadSetup(torrentData, recommendation, function(action, options) {
                    if (action === 'start') {
                        // Запускаем предзагрузку
                        TorrServeAPI.startPreload(torrentData.magnet, 0, options, function(error, result) {
                            if (error) {
                                Lampa.Noty.show('Ошибка запуска предзагрузки: ' + error, {type: 'error'});
                            } else {
                                Lampa.Noty.show('Предзагрузка запущена!', {type: 'success'});
                                
                                // Показываем экран прогресса
                                PreloadUI.showPreloadProgress(torrentData, result.task_id);
                            }
                        });
                    }
                });
            });
        },

        // Обработка выбора просмотра
        handleWatchChoice: function(fileData, element) {
            console.log('[Lampa Integration] Запуск просмотра для:', fileData.file_title);
            
            if (element && window.Lampa && window.Lampa.Player) {
                // Используем стандартный механизм Lampa для воспроизведения
                console.log('[Lampa Integration] Используем стандартный Player Lampa');
                
                // Вызываем оригинальную функцию Player.play
                if (LampaIntegration.originalPlayerPlay) {
                    LampaIntegration.originalPlayerPlay.call(window.Lampa.Player, element);
                } else {
                    // Fallback - прямой вызов
                    window.Lampa.Player.play(element);
                }
                
                // Настраиваем callback если нужно
                if (window.Lampa.Player.callback) {
                    window.Lampa.Player.callback(function() {
                        if (window.Lampa.Controller) {
                            window.Lampa.Controller.toggle('modal');
                        }
                    });
                }
            } else {
                // Fallback через наш метод
                PreloadUI.startWatching(fileData);
            }
        }
    };

    // Инициализация плагина при загрузке Lampa
    if (window.Lampa) {
        LampaIntegration.init();
    } else {
        // Ждем загрузки Lampa
        $(document).ready(function() {
            var checkLampa = setInterval(function() {
                if (window.Lampa) {
                    clearInterval(checkLampa);
                    LampaIntegration.init();
                }
            }, 100);
        });
    }

    console.log('[TorrServe Smart Preload] Плагин загружен');

})();
