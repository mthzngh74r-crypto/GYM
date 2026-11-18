export interface GenerateResult {
  source: 'ai' | 'rules';
  fallbackReason?: string;
}

export async function generateForWorkout(_workoutId: string): Promise<GenerateResult> {
  throw new Error('Генератор ещё не подключён');
}

export async function suggestAlternative(_weId: string): Promise<void> {
  throw new Error('Генератор ещё не подключён');
}
