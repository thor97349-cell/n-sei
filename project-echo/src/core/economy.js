// Match economy: credits, buy rules, round rewards. Pure logic.
import { ECONOMY, WEAPONS, ARMOR } from '../config.js';

export class Economy {
  constructor() { this.resetMatch(); }

  resetMatch() {
    this.credits = ECONOMY.startingCredits;
    this.lossStreak = 0;
    this.roundKills = 0;
    this.roundKillCredits = 0;
  }

  add(amount) {
    this.credits = Math.min(ECONOMY.maxCredits, this.credits + amount);
  }

  lossReward() {
    return Math.min(ECONOMY.lossRewardMax, ECONOMY.lossReward + ECONOMY.lossBonusStep * this.lossStreak);
  }

  addKill(weaponId) {
    const r = WEAPONS[weaponId]?.killReward || 0;
    this.roundKills++;
    this.roundKillCredits += r;
    this.add(r);
    return r;
  }

  // Applies the round result and returns a summary for the HUD.
  endRound(won) {
    const reward = won ? ECONOMY.winReward : this.lossReward();
    if (won) this.lossStreak = 0;
    else this.lossStreak = Math.min(this.lossStreak + 1, 10);
    this.add(reward);
    const summary = { won, reward, kills: this.roundKills, killCredits: this.roundKillCredits, credits: this.credits, nextLossBonus: this.lossReward() };
    this.roundKills = 0;
    this.roundKillCredits = 0;
    return summary;
  }

  // loadout = { primary: id|null, armor: number, ... }. Returns {ok, reason}.
  canBuy(item, loadout) {
    if (item.type === 'weapon' && loadout.primary === item.weapon) return { ok: false, reason: 'Already equipped' };
    if (item.type === 'armor' && loadout.armor >= ARMOR.max) return { ok: false, reason: 'Armor full' };
    if (this.credits < item.price) return { ok: false, reason: 'Not enough credits' };
    return { ok: true };
  }

  buy(item, loadout) {
    const c = this.canBuy(item, loadout);
    if (!c.ok) return c;
    this.credits -= item.price;
    return { ok: true };
  }
}

export function findItem(id) {
  return ECONOMY.items.find((i) => i.id === id);
}
