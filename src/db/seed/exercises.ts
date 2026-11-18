import type { Equipment, Exercise, ExerciseKind, MuscleGroup } from '../../domain/types';

type Row = [id: string, name: string, muscle: MuscleGroup, kind: ExerciseKind, equipment: Equipment[], secondary?: MuscleGroup[]];

const C: ExerciseKind = 'compound';
const I: ExerciseKind = 'isolation';

const ROWS: Row[] = [
  // Грудь
  ['bench_press', 'Жим штанги лёжа', 'chest', C, ['barbell', 'bench'], ['triceps', 'shoulders']],
  ['incline_bench_press', 'Жим штанги на наклонной скамье', 'chest', C, ['barbell', 'bench'], ['shoulders', 'triceps']],
  ['db_bench_press', 'Жим гантелей лёжа', 'chest', C, ['dumbbell', 'bench'], ['triceps']],
  ['incline_db_press', 'Жим гантелей на наклонной скамье', 'chest', C, ['dumbbell', 'bench'], ['shoulders']],
  ['dips_chest', 'Отжимания на брусьях (акцент на грудь)', 'chest', C, ['dip_bars'], ['triceps']],
  ['pushups', 'Отжимания от пола', 'chest', C, ['bodyweight'], ['triceps']],
  ['machine_chest_press', 'Жим в тренажёре сидя', 'chest', C, ['machine'], ['triceps']],
  ['smith_incline_press', 'Жим в Смите на наклонной', 'chest', C, ['smith', 'bench'], ['shoulders']],
  ['db_fly', 'Разводка гантелей лёжа', 'chest', I, ['dumbbell', 'bench']],
  ['cable_crossover', 'Сведение рук в кроссовере', 'chest', I, ['cable']],
  ['pec_deck', 'Бабочка (пек-дек)', 'chest', I, ['machine']],
  // Спина
  ['pullups', 'Подтягивания широким хватом', 'back', C, ['pullup_bar'], ['biceps']],
  ['chinups', 'Подтягивания обратным хватом', 'back', C, ['pullup_bar'], ['biceps']],
  ['barbell_row', 'Тяга штанги в наклоне', 'back', C, ['barbell'], ['biceps']],
  ['db_row', 'Тяга гантели одной рукой', 'back', C, ['dumbbell', 'bench'], ['biceps']],
  ['lat_pulldown', 'Тяга верхнего блока к груди', 'back', C, ['cable'], ['biceps']],
  ['seated_cable_row', 'Тяга нижнего блока сидя', 'back', C, ['cable'], ['biceps']],
  ['tbar_row', 'Тяга Т-грифа', 'back', C, ['barbell'], ['biceps']],
  ['deadlift', 'Становая тяга', 'back', C, ['barbell'], ['hamstrings', 'glutes']],
  ['machine_row', 'Тяга в рычажном тренажёре', 'back', C, ['machine'], ['biceps']],
  ['straight_arm_pulldown', 'Пулловер на блоке прямыми руками', 'back', I, ['cable']],
  ['db_pullover', 'Пулловер с гантелью', 'back', I, ['dumbbell', 'bench'], ['chest']],
  ['hyperextension', 'Гиперэкстензия', 'back', I, ['bodyweight'], ['glutes', 'hamstrings']],
  ['inverted_row', 'Австралийские подтягивания', 'back', C, ['pullup_bar']],
  // Плечи
  ['ohp', 'Жим штанги стоя', 'shoulders', C, ['barbell'], ['triceps']],
  ['seated_db_press', 'Жим гантелей сидя', 'shoulders', C, ['dumbbell', 'bench'], ['triceps']],
  ['arnold_press', 'Жим Арнольда', 'shoulders', C, ['dumbbell'], ['triceps']],
  ['machine_shoulder_press', 'Жим в тренажёре на плечи', 'shoulders', C, ['machine'], ['triceps']],
  ['lateral_raise', 'Махи гантелями в стороны', 'shoulders', I, ['dumbbell']],
  ['cable_lateral_raise', 'Отведение руки в сторону на блоке', 'shoulders', I, ['cable']],
  ['rear_delt_fly', 'Разводка в наклоне на заднюю дельту', 'shoulders', I, ['dumbbell']],
  ['face_pull', 'Тяга каната к лицу', 'shoulders', I, ['cable'], ['back']],
  ['reverse_pec_deck', 'Обратная бабочка', 'shoulders', I, ['machine']],
  // Трицепс
  ['close_grip_bench', 'Жим лёжа узким хватом', 'triceps', C, ['barbell', 'bench'], ['chest']],
  ['dips_triceps', 'Отжимания на брусьях (акцент на трицепс)', 'triceps', C, ['dip_bars']],
  ['skull_crusher', 'Французский жим лёжа', 'triceps', I, ['ez_bar', 'bench']],
  ['rope_pushdown', 'Разгибание рук на блоке с канатом', 'triceps', I, ['cable']],
  ['bar_pushdown', 'Разгибание рук на блоке с прямой рукоятью', 'triceps', I, ['cable']],
  ['overhead_db_extension', 'Разгибание гантели из-за головы', 'triceps', I, ['dumbbell']],
  ['overhead_cable_extension', 'Разгибание на блоке из-за головы', 'triceps', I, ['cable']],
  ['bench_dips', 'Обратные отжимания от скамьи', 'triceps', I, ['bench']],
  ['diamond_pushups', 'Алмазные отжимания', 'triceps', C, ['bodyweight'], ['chest']],
  // Бицепс
  ['barbell_curl', 'Подъём штанги на бицепс', 'biceps', I, ['barbell']],
  ['ez_curl', 'Подъём EZ-грифа на бицепс', 'biceps', I, ['ez_bar']],
  ['db_curl', 'Подъём гантелей с супинацией', 'biceps', I, ['dumbbell']],
  ['hammer_curl', 'Молотки', 'biceps', I, ['dumbbell'], ['forearms']],
  ['incline_db_curl', 'Сгибания на наклонной скамье', 'biceps', I, ['dumbbell', 'bench']],
  ['preacher_curl', 'Сгибания на скамье Скотта', 'biceps', I, ['ez_bar', 'bench']],
  ['cable_curl', 'Сгибания рук на нижнем блоке', 'biceps', I, ['cable']],
  ['concentration_curl', 'Концентрированный подъём', 'biceps', I, ['dumbbell']],
  // Предплечья
  ['wrist_curl', 'Сгибания запястий со штангой', 'forearms', I, ['barbell']],
  ['reverse_curl', 'Подъём штанги обратным хватом', 'forearms', I, ['barbell'], ['biceps']],
  // Пресс
  ['hanging_leg_raise', 'Подъём ног в висе', 'abs', I, ['pullup_bar']],
  ['cable_crunch', 'Скручивания на блоке', 'abs', I, ['cable']],
  ['crunch', 'Скручивания на полу', 'abs', I, ['bodyweight']],
  ['plank', 'Планка (повторы = секунды/10)', 'abs', I, ['bodyweight']],
  ['ab_wheel', 'Ролик для пресса', 'abs', I, ['bodyweight']],
  ['lying_leg_raise', 'Подъём ног лёжа', 'abs', I, ['bodyweight']],
  // Ноги — базовые
  ['back_squat', 'Приседания со штангой', 'quads', C, ['barbell'], ['glutes', 'hamstrings']],
  ['front_squat', 'Фронтальные приседания', 'quads', C, ['barbell'], ['glutes']],
  ['leg_press', 'Жим ногами', 'quads', C, ['machine'], ['glutes']],
  ['hack_squat', 'Гакк-приседания', 'quads', C, ['machine'], ['glutes']],
  ['bulgarian_split_squat', 'Болгарские выпады', 'quads', C, ['dumbbell', 'bench'], ['glutes']],
  ['walking_lunges', 'Выпады с гантелями в ходьбе', 'quads', C, ['dumbbell'], ['glutes']],
  ['goblet_squat', 'Гоблет-присед', 'quads', C, ['dumbbell'], ['glutes']],
  ['romanian_deadlift', 'Румынская тяга', 'hamstrings', C, ['barbell'], ['glutes', 'back']],
  ['db_romanian_deadlift', 'Румынская тяга с гантелями', 'hamstrings', C, ['dumbbell'], ['glutes']],
  ['hip_thrust', 'Ягодичный мост со штангой', 'glutes', C, ['barbell', 'bench'], ['hamstrings']],
  ['sumo_deadlift', 'Становая тяга сумо', 'glutes', C, ['barbell'], ['quads', 'hamstrings']],
  // Ноги — изолирующие
  ['leg_extension', 'Разгибание ног в тренажёре', 'quads', I, ['machine']],
  ['lying_leg_curl', 'Сгибание ног лёжа', 'hamstrings', I, ['machine']],
  ['seated_leg_curl', 'Сгибание ног сидя', 'hamstrings', I, ['machine']],
  ['cable_kickback', 'Отведение ноги назад на блоке', 'glutes', I, ['cable']],
  ['hip_abduction', 'Разведение ног в тренажёре', 'glutes', I, ['machine']],
  ['nordic_curl', 'Скандинавские сгибания', 'hamstrings', I, ['bodyweight']],
  ['glute_bridge', 'Ягодичный мост на полу', 'glutes', I, ['bodyweight']],
  // Икры
  ['standing_calf_raise', 'Подъём на носки стоя', 'calves', I, ['machine']],
  ['seated_calf_raise', 'Подъём на носки сидя', 'calves', I, ['machine']],
  ['db_calf_raise', 'Подъём на носки с гантелью на одной ноге', 'calves', I, ['dumbbell']],
  ['leg_press_calf_raise', 'Икры в тренажёре для жима ногами', 'calves', I, ['machine']],
];

export const SEED_EXERCISES: Exercise[] = ROWS.map(([id, name, muscleGroup, kind, equipment, secondary]) => ({
  id,
  name,
  muscleGroup,
  kind,
  equipment,
  secondary,
  isCustom: false,
}));
