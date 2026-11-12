// Тексты по роду активного профиля: g('Съела', 'Съел')
import { WHO } from './data/program.js';
export const g = (her, him) => (WHO === 'him' ? him : her);
