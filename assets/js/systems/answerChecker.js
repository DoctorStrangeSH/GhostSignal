class AnswerChecker {
    constructor() {
        this.attempts = 0;
        this.maxAttempts = 3;
        this.caseResult = null; // 'solved' | 'failed' | null
    }
    
    // Проверить ответ
    checkAnswer(userAnswer, acceptableAnswers) {
        if (!userAnswer || userAnswer.trim() === '') {
            return {
                isCorrect: false,
                reason: 'empty',
                message: 'Введите ответ'
            };
        }
        
        this.attempts++;
        
        const normalizedInput = this._normalize(userAnswer);
        
        // Проверяем все приемлемые ответы
        for (const answer of acceptableAnswers) {
            const normalizedAnswer = this._normalize(answer);
            
            // Точное совпадение
            if (normalizedInput === normalizedAnswer) {
                this.caseResult = 'solved';
                return {
                    isCorrect: true,
                    attempts: this.attempts,
                    matchedAnswer: answer
                };
            }
            
            // Проверка через Левенштейн (для опечаток)
            if (normalizedInput.length > 3) {
                const distance = this._levenshtein(normalizedInput, normalizedAnswer);
                const threshold = Math.max(2, Math.floor(normalizedAnswer.length * 0.25));
                
                if (distance <= threshold) {
                    this.caseResult = 'solved';
                    return {
                        isCorrect: true,
                        attempts: this.attempts,
                        matchedAnswer: answer,
                        hadTypo: distance > 0
                    };
                }
            }
            
            // Частичное совпадение (содержит ключевые слова)
            if (this._containsKeywords(normalizedInput, normalizedAnswer)) {
                this.caseResult = 'solved';
                return {
                    isCorrect: true,
                    attempts: this.attempts,
                    matchedAnswer: answer,
                    partialMatch: true
                };
            }
        }
        
        // Все попытки исчерпаны
        if (this.attempts >= this.maxAttempts) {
            this.caseResult = 'failed';
            return {
                isCorrect: false,
                attempts: this.attempts,
                maxAttempts: this.maxAttempts,
                isFinal: true,
                message: 'Попытки исчерпаны. Дело остаётся нераскрытым.'
            };
        }
        
        return {
            isCorrect: false,
            attempts: this.attempts,
            maxAttempts: this.maxAttempts,
            remainingAttempts: this.maxAttempts - this.attempts,
            message: `Неверно. Осталось попыток: ${this.maxAttempts - this.attempts}`
        };
    }
    
    // Сбросить счётчик
    reset() {
        this.attempts = 0;
        this.caseResult = null;
    }
    
    // Нормализация текста
    _normalize(text) {
        return text
            .toLowerCase()
            .trim()
            .replace(/[^a-zа-яё0-9\s]/g, '') // Убираем спецсимволы
            .replace(/\s+/g, ' ')              // Схлопываем пробелы
            .replace(/ё/g, 'е');               // Заменяем ё на е
    }
    
    // Проверка на ключевые слова
    _containsKeywords(input, answer) {
        const inputWords = input.split(' ').filter(w => w.length > 2);
        const answerWords = answer.split(' ').filter(w => w.length > 2);
        
        if (inputWords.length === 0 || answerWords.length === 0) return false;
        
        const matchedWords = answerWords.filter(aw => 
            inputWords.some(iw => {
                const dist = this._levenshtein(iw, aw);
                return dist <= 1; // Почти точное совпадение
            })
        );
        
        // Если совпало больше половины ключевых слов
        return matchedWords.length >= Math.ceil(answerWords.length * 0.6);
    }
    
    // Расстояние Левенштейна
    _levenshtein(a, b) {
        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;
        
        const matrix = [];
        for (let i = 0; i <= b.length; i++) matrix[i] = [i];
        for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
        
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                const cost = b.charAt(i - 1) === a.charAt(j - 1) ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j - 1] + cost
                );
            }
        }
        return matrix[b.length][a.length];
    }
}