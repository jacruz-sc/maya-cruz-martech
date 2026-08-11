import type { SystemRepository } from './system.repository.js';
export class SystemService {
  constructor(private readonly repository: SystemRepository) {}
  live() {
    return true;
  }
  ready() {
    return this.repository.checkDatabase();
  }
}
