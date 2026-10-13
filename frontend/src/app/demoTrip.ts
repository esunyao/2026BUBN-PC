import type { Island, Participant, Photo } from '../shared/types'
import { islandPosition } from '../shared/lib/layout'

export const demoParticipants: Participant[] = [
  { id: 'lin', name: '小林', initials: '林', color: '#e89062' },
  { id: 'yu', name: '阿屿', initials: '屿', color: '#6699c5' },
  { id: 'an', name: '安安', initials: '安', color: '#a59ac9' },
]

const places = [
  '海风车站',
  '住过的民宿',
  '贝壳海滩',
  '蓝色灯塔',
  '森林营地',
  '午后集市',
  '海边咖啡馆',
  '山间瀑布',
  '星光音乐会',
  '日落栈桥',
]
const captions = [
  ['第一班列车，带着一点困意和很多期待。', '我们的夏天从海风车站出发。'],
  ['放下行李，打开窗就是海。', '住过的小房子，也留住了我们的笑声。'],
  ['捡到一枚像月亮的贝壳。', '鞋里装满沙子，心里装满海。'],
  ['灯塔替我们记住了海的颜色。', '爬了好多级台阶，风景值得。'],
  ['树影晃着，大家都想打个盹。', '在森林里交换一小会儿安静。'],
  ['摊主说，今天的桃子特别甜。', '把热闹装进相机里。'],
  ['冰咖啡和海浪声，刚好的午后。', '慢一点，再聊一会儿。'],
  ['沿着水声走，终于找到山间的瀑布。', '飞起的水雾，把疲惫都带走了。'],
  ['第一颗星亮起，我们跟着音乐轻轻唱。', '这场露天音乐会，唱到了心里。'],
  ['太阳落下之前，再靠近一点。', '在栈桥尽头，约好下次还要一起出发。'],
]

export function createDemoTrip() {
  const islands: Island[] = places.map((name, index) => ({
    id: `island-${index + 1}`,
    name,
    appearance: index,
    position: islandPosition(index),
    gpsAnchor: {
      latitude: 24.45 + index * 0.008,
      longitude: 118.08 + index * 0.009,
    },
  }))
  const photos: Photo[] = islands.flatMap((island, index) =>
    [0, 1].map((part) => ({
      id: `demo-${index + 1}-${part}`,
      url: `/memories/moment-${String(index + 1).padStart(2, '0')}${part === 1 ? '-b' : ''}.webp`,
      filename: `夏日漫游-${index + 1}-${part + 1}.webp`,
      caption: captions[index]?.[part] ?? island.name,
      photographerId: demoParticipants[(index + part) % 3]!.id,
      islandId: island.id,
      gps: island.gpsAnchor,
      capturedAt: new Date(2026, 7, 16, 8, Math.round(((index * 2 + part) * 720) / 19)).getTime(),
      importOrder: index * 2 + part,
      source: 'demo' as const,
    })),
  )
  return {
    islands,
    photos,
    participants: demoParticipants.map((person) => ({ ...person })),
  }
}
