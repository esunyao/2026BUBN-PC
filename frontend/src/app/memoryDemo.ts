import type { EnvironmentPreset, EnvironmentRecipe, MemoryData } from '../shared/memoryTypes'

export const presets: Record<EnvironmentPreset, EnvironmentRecipe> = {
  coastal: recipe('coastal', '#f6f2ea', '#a37855', 'linen', 'shell'),
  alpine: recipe('alpine', '#edf0e8', '#566957', 'stone', 'branch'),
  urban: recipe('urban', '#e9e5df', '#746052', 'stone', 'ticket'),
  ceremony: recipe('ceremony', '#eee4d9', '#985e41', 'velvet', 'program'),
  neutral: recipe('neutral', '#f6f2ea', '#745d4d', 'paper', 'ticket'),
}
function recipe(
  preset: EnvironmentPreset,
  base: string,
  accent: string,
  texture: string,
  prop: string,
): EnvironmentRecipe {
  return {
    preset,
    lighting: 'golden-hour',
    palette: { base, paper: '#fffcf5', ink: '#292824', accent, overlay: '#d9af78' },
    surfaceTexture: `/demo-assets/${texture}.svg`,
    props: [
      { assetId: prop, anchor: 'br', scale: 1, opacity: 0.22, rotation: -12 },
      { assetId: prop, anchor: 'tl', scale: 0.6, opacity: 0.12, rotation: 24 },
    ],
    blurPx: 35,
    vignette: 0.12,
    grainOpacity: 0.12,
    parallaxStrength: 6,
  }
}
const image = (id: number) => `/demo-assets/${id}.jpg`
export function createMemoryDemo(): MemoryData {
  const data: MemoryData = {
    participants: [
      { id: 'a', displayName: '林晚', color: '#a47859' },
      { id: 'b', displayName: '陈屿', color: '#6a7f76' },
      { id: 'c', displayName: '小满', color: '#9f8792' },
    ],
    events: [
      {
        id: 'hailing',
        startAt: '2026-08-16T08:00:00+08:00',
        endAt: '2026-08-17T22:00:00+08:00',
        title: '海陵岛之旅',
        subtitle: '三个人，一段留在夏天的时光。',
        type: 'trip',
        sceneIds: ['coast', 'mountain', 'city'],
        participantIds: ['a', 'b', 'c'],
        isDemo: true,
      },
      {
        id: 'gala',
        startAt: '2026-10-01T08:00:00+08:00',
        endAt: '2027-01-01T22:00:00+08:00',
        title: '元旦晚会',
        subtitle: '从第一张节目单，到最后一次谢幕。',
        type: 'longActivity',
        sceneIds: ['stage'],
        participantIds: ['a', 'b', 'c'],
        isDemo: true,
      },
    ],
    scenes: [
      {
        id: 'coast',
        eventId: 'hailing',
        title: '海边漫步',
        subtitle: '潮汐来过，光也来过。',
        momentIds: ['coast-morning', 'coast-afternoon', 'coast-sunset', 'coast-evening'],
        environment: structuredClone(presets.coastal),
      },
      {
        id: 'mountain',
        eventId: 'hailing',
        title: '山野来信',
        subtitle: '在风经过的山脊，停留片刻。',
        momentIds: ['mountain-walk'],
        environment: structuredClone(presets.alpine),
      },
      {
        id: 'city',
        eventId: 'hailing',
        title: '城市重逢',
        subtitle: '灯亮起来的时候，旅途还没有结束。',
        momentIds: ['city-night'],
        environment: structuredClone(presets.urban),
      },
      {
        id: 'stage',
        eventId: 'gala',
        title: '灯亮之前，灯亮之后',
        subtitle: '把三个月的准备，留在这一晚。',
        momentIds: ['stage-plan', 'stage-rehearsal', 'stage-ready', 'stage-show', 'stage-curtain'],
        environment: structuredClone(presets.ceremony),
      },
    ],
    moments: [],
    contributions: [],
    links: [],
    pairs: [],
  }
  function moment(
    id: string,
    sceneId: string,
    title: string,
    startAt: string,
    label: string,
    lighting: EnvironmentRecipe['lighting'],
    photos: Array<[number, string, string]>,
  ) {
    const ids = photos.map((_, index) => `${id}-${index}`)
    data.moments.push({ id, sceneId, title, startAt, label, lighting, contributionIds: ids })
    photos.forEach(([asset, alt, text], index) =>
      data.contributions.push({
        id: ids[index]!,
        momentId: id,
        participantId: ['a', 'b', 'c'][index % 3]!,
        kind: 'photo',
        mediaUrl: image(asset),
        thumbnailUrl: `/demo-assets/${asset}-thumb.jpg`,
        alt,
        writtenText: text,
        mood: ['平静'],
        isDemo: true,
      }),
    )
    data.links.push({
      id: `link-${id}`,
      momentIds: [id],
      contributionIds: ids,
      relation: 'sameMoment',
      reason:
        sceneId === 'stage' ? '同一活动阶段 · 手工演示关联' : '同一场景时间窗口 · 手工演示关联',
      confidence: 0.9,
    })
  }
  moment('coast-morning', 'coast', '海风初见', '2026-08-16T09:20:00+08:00', '09:20', 'morning', [
    [27302088, '沙丘与清晨的海岸', '沿着沙丘走到了海边。'],
    [20109401, '浪花环绕的海岸', '从高处看见海岸的曲线。'],
    [16120955, '海浪拍打岸边的岩石', '停下来拍了一张浪花。'],
  ])
  moment(
    'coast-afternoon',
    'coast',
    '午后的潮汐',
    '2026-08-16T14:30:00+08:00',
    '14:30',
    'overcast',
    [
      [18777464, '绿色沙丘和沙滩', '午后的沙丘，路一直延伸到海边。'],
      [16414497, '海浪与沙滩的纹理', '把沙滩上的纹理留了下来。'],
      [9657794, '海岸水面的抽象纹理', '这一张拍的是水与沙的交界。'],
    ],
  )
  moment(
    'coast-sunset',
    'coast',
    '日落时，另一双眼睛',
    '2026-08-16T18:40:00+08:00',
    '18:40',
    'golden-hour',
    [
      [35754189, '落日映照在海面上', '太阳落下时，海面变成了金色。'],
      [5579143, '站在海边的朋友背影', '我把镜头转向了站在岸边的人。'],
      [26584348, '坐在沙滩上看日落的人们', '大家在海边坐了一会儿。'],
      [33356268, '海浪冲过湿润的沙滩', '最后留下一张潮水。'],
    ],
  )
  moment(
    'mountain-walk',
    'mountain',
    '经过山脊',
    '2026-08-17T10:00:00+08:00',
    '次日 · 10:00',
    'overcast',
    [
      [30748642, '阳光下的山野', '走到山脊，拍下远处的山。'],
      [33515294, '雾中的山峰', '另一侧，山峰藏在雾里。'],
      [18777464, '延伸在绿地中的小路', '这张作为自然章节的素材样例。'],
    ],
  )
  moment('city-night', 'city', '灯影入水', '2026-08-17T20:00:00+08:00', '次日 · 20:00', 'night', [
    [4912393, '城市灯光映在水面', '夜晚的灯映在水里。'],
    [4912393, '沿水岸的夜色', '沿水岸走了一段路。'],
    [4912393, '远山与城市夜灯', '抬头的时候还看得见远山。'],
  ])
  moment(
    'stage-plan',
    'stage',
    '十月 · 第一场筹备',
    '2026-10-10T14:00:00+08:00',
    '10月 · 筹备',
    'morning',
    [
      [29858811, '准备搭建的空舞台', '舞台还空着，设备刚刚搬进来。'],
      [4872022, '围桌讨论的筹备团队', '第一次围在桌前讨论节目。'],
      [6476184, '团队在会议桌旁记录计划', '把讨论记在了纸上。'],
    ],
  )
  moment(
    'stage-rehearsal',
    'stage',
    '十二月 · 彩排',
    '2026-12-20T16:00:00+08:00',
    '12月 · 彩排',
    'overcast',
    [
      [6896333, '演员在舞台上排练', '彩排时，重新走了一遍站位。'],
      [32388451, '服装与后台准备', '后台的服装已经准备好了。'],
      [29858811, '搭建阶段的舞台设备', '设备调试还在继续。'],
    ],
  )
  moment(
    'stage-show',
    'stage',
    '一月 · 演出开始',
    '2027-01-01T19:30:00+08:00',
    '1月1日 · 19:30',
    'stage-warm',
    [
      [167587, '演出舞台与观众', '灯光亮起来，演出开始。'],
      [6899928, '从后台看到的舞台演员', '从侧幕后留下了这个视角。'],
      [11794650, '舞台上的乐队', '在台下记录了乐队的演出。'],
    ],
  )
  moment(
    'stage-curtain',
    'stage',
    '最后一束灯',
    '2027-01-01T21:00:00+08:00',
    '1月1日 · 21:00',
    'night',
    [
      [6899928, '演员与舞台灯光', '最后一次走回舞台。'],
      [32388451, '演出后台与服装', '结束后回到了后台。'],
      [11794650, '乐队演出现场', '把最后一段表演留了下来。'],
    ],
  )
  moment('coast-evening', 'coast', '夜色到来', '2026-08-16T20:05:00+08:00', '20:05', 'night', [
    [33356268, '晚间章节的海浪素材', '夜色章节的演示记录。'],
    [16414497, '岸边潮水的素材照片', '在岸边留下另一张记录。'],
    [26584348, '海边的人们', '这一段使用海岸摄影作为演示素材。'],
  ])
  moment(
    'stage-ready',
    'stage',
    '演出前 · 准备就绪',
    '2027-01-01T17:45:00+08:00',
    '1月1日 · 17:45',
    'stage-warm',
    [
      [32388451, '后台的演出服装', '开演前记录了后台的准备。'],
      [6899928, '从侧幕看舞台', '从侧幕拍下舞台。'],
      [29858811, '舞台设备的示例素材', '设备准备阶段的素材样例。'],
    ],
  )
  data.moments.sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt))
  for (const c of data.contributions) {
    const m = data.moments.find((m) => m.id === c.momentId)!
    c.visibility = 'event-members'
    c.timeEvidence = { start: m.startAt, precision: 'approximate', source: 'demo' }
    c.analysis = {
      sceneTags: [m.sceneId],
      objects: [],
      activities: [],
      phaseTags: m.id.includes('plan')
        ? ['planning']
        : m.id.includes('rehearsal')
          ? ['rehearsal']
          : m.id.includes('ready') || (m.id === 'stage-show' && c.participantId === 'b')
            ? ['backstage']
            : m.id.includes('show')
              ? ['performance']
              : [],
      modelId: 'manual-demo-annotations',
      version: '1',
    }
  }
  data.pairs = [
    {
      id: 'coast-pair',
      sceneId: 'coast',
      beforeContributionId: 'coast-morning-0',
      afterContributionId: 'coast-sunset-0',
      comparisonMode: 'sideBySide',
    },
    {
      id: 'stage-pair',
      sceneId: 'stage',
      beforeContributionId: 'stage-plan-0',
      afterContributionId: 'stage-show-0',
      comparisonMode: 'sideBySide',
    },
  ]
  return data
}
