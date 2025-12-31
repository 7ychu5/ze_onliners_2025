// s2ts v0.6.1
import { Instance } from 'cs_script/point_script';

class DamageModifierSystem {
    constructor() {
        this.modifiers = [];
        Instance.OnBeforePlayerDamage((event) => {
            return this.processDamageModifiers(event);
        });
    }
    registerModifier(name, priority, modifier) {
        this.unregisterModifier(name);
        this.modifiers.push({ name, priority, modifier });
        this.modifiers.sort((a, b) => b.priority - a.priority);
    }
    unregisterModifier(name) {
        this.modifiers = this.modifiers.filter(m => m.name !== name);
    }
    processDamageModifiers(event) {
        let currentEvent = Object.assign({}, event);
        let finalDamage = event.damage;
        for (const modifier of this.modifiers) {
            try {
                const result = modifier.modifier(currentEvent);
                if (result && typeof result === 'object' && result.damage !== undefined) {
                    finalDamage = result.damage;
                    currentEvent.damage = finalDamage;
                }
            }
            catch (error) {
                utils.printl(`伤害修改器 ${modifier.name} 错误: ${error}`);
            }
        }
        return { damage: finalDamage };
    }
}
const damageModifierSystem = new DamageModifierSystem();

export { damageModifierSystem };
