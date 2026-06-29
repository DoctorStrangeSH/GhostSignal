class EvidenceChainSystem {
    constructor(inventory) {
        this.inventory = inventory;
        this.chains = [];          // Зарегистрированные цепочки
        this.completedChains = []; // Завершённые цепочки
    }
    
    // Зарегистрировать цепочку улик
    registerChain(config) {
        this.chains.push({
            id: config.id,
            name: config.name,
            requiredEvidence: config.requiredEvidence,  // Массив ID улик
            requiredInsights: config.requiredInsights || [],
            bonusInsight: config.bonusInsight,
            bonusEvidence: config.bonusEvidence,
            description: config.description
        });
    }
    
    // Проверить, есть ли все улики для цепочки
    checkChains() {
        this.chains.forEach(chain => {
            if (this.completedChains.includes(chain.id)) return;
            
            const hasAllEvidence = chain.requiredEvidence.every(id => 
                this.inventory.hasItem(id)
            );
            const hasAllInsights = chain.requiredInsights.every(id => 
                this.inventory.hasInsight(id)
            );
            
            if (hasAllEvidence && hasAllInsights) {
                this._completeChain(chain);
            }
        });
    }
    
    _completeChain(chain) {
        this.completedChains.push(chain.id);
        
        // Бонусное озарение
        if (chain.bonusInsight) {
            this.inventory.addInsight(chain.bonusInsight);
        }
        
        // Бонусная улика
        if (chain.bonusEvidence) {
            events.emit('evidence:from_chain', chain.bonusEvidence);
        }
        
        events.emit('notification:show', {
            message: `🔗 Цепочка улик: ${chain.name} — ${chain.description}`,
            type: 'success',
            duration: 5000
        });
    }
    
    // Загрузить цепочки для дела
    loadChainsForCase(caseData) {
        this.chains = [];
        this.completedChains = [];
        
        if (caseData?.evidenceChains) {
            caseData.evidenceChains.forEach(chain => this.registerChain(chain));
        }
    }
    
    // Сериализация
    toJSON() {
        return {
            completedChains: [...this.completedChains]
        };
    }
    
    static fromJSON(json, inventory) {
        const system = new EvidenceChainSystem(inventory);
        if (json) {
            system.completedChains = json.completedChains || [];
        }
        return system;
    }
}