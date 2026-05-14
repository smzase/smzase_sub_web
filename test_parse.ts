import { parseAnimeReadme } from './src/utils/readme.ts';

const md = \## 与游戏中心的少女异文化交流的故事

> 在游戏厅打工的少草壁莲司，偶然注意到了一个身影，在情人节那天，一位英国少女莉莉一个人沉迷于抓娃娃机。<br>
> 可她玩了很久都抓不到一个，莲司看到急得眼泪杨洋的她，忍不住伸出了援手。<br>
> 在顺利抓到布偶的几天后，这位少女递给少年一张意想不到的卡片。<br><br>
> Be My Valentine!（做我的恋人吧！）<br><br>
> 与天真烂漫的英国少女相遇。一场始于误会的游戏厅异文化交流就此拉开序幕！

| 职位 | 人员 |
| --- | --- |
| 翻译 | smzase<br>MoYuanCN |
| 时轴、特效、美工 | smzase |

## 字幕列表

## 使用字体

| 字体整合包 |
| --- |
| https://sub.072158.xyz/font-packages/%E4%B8%8E%E6%B8%B8%E6%88%8F%E4%B8%AD%E5%BF%83%E7%9A%84%E5%B0%91%E5%A5%B3%E5%BC%82%E6%96%87%E5%8C%96%E4%BA%A4%E6%B5%81%E7%9A%84%E6%95%85%E4%BA%8B%20%E5%AD%97%E4%BD%93%E6%95%B4%E5%90%88%E5%8C%85.7z |

| 字体名 | 字体下载 |
| --- | --- |
\

const parsed = parseAnimeReadme(md);
console.log(JSON.stringify(parsed, null, 2));
