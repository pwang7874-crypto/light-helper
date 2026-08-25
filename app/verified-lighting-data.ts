export type VerifiedLight = { modelId:string; brand:string; model:string; cct:number; distanceM:number; bareLux:number|null; modifierLux:number|null; modifier:string; source:string; verifiedAt:string };

// Only manufacturer-published 100% output measurements are admitted here.
export const verifiedLights: VerifiedLight[] = [
  { modelId:"zhiyun-g200", brand:"智云", model:"MOLUS G200", cct:6500, distanceM:1, bareLux:9460, modifierLux:61500, modifier:"标配反光罩", source:"https://zyserver1.zhiyun-tech.com/en/product/param/816?page=second_nav&source=param&type=website", verifiedAt:"2026-08-14" },
  { modelId:"smallrig-220b", brand:"SmallRig", model:"RC 220B", cct:5600, distanceM:1, bareLux:8670, modifierLux:84500, modifier:"Hyper Reflector", source:"https://www.smallrig.com/smallrig-rc-220b-point-source-video-light-australian-standard-3623.html", verifiedAt:"2026-08-14" },
  { modelId:"aputure-300x", brand:"爱图仕", model:"LS 300x", cct:5500, distanceM:1, bareLux:6300, modifierLux:20500, modifier:"Hyper-Reflector", source:"https://docs.aputure.com/hubfs/Knowledge%20Base/Aputure/LS%20300x/All%20files/LS_300x-Product_Manual_EN.pdf", verifiedAt:"2026-08-14" },
  { modelId:"godox-sl150ii", brand:"神牛", model:"SL150II", cct:5600, distanceM:1, bareLux:null, modifierLux:58000, modifier:"官方 1m/100% 测试配置", source:"https://cn.godox.com/press-center/256.html", verifiedAt:"2026-08-14" }
  ,{ modelId:"amaran-300c", brand:"Amaran", model:"300c", cct:5600, distanceM:1, bareLux:9370, modifierLux:26580, modifier:"LS 600 Hyper Reflector", source:"https://docs.aputure.com/hubfs/Knowledge%20Base/amaran/150c-300c/All%20Files/amaran%20300c%20Product%20Manual%20.pdf", verifiedAt:"2026-08-14" }
  ,{ modelId:"amaran-60x-s", brand:"Amaran", model:"60x S", cct:5600, distanceM:1, bareLux:2427, modifierLux:33300, modifier:"Hyper Reflector", source:"https://docs.aputure.com/hubfs/Knowledge%20Base/amaran/amaran%2060x%20S/All%20files/amaran-60x-S-Product-Manual-V1.0.pdf", verifiedAt:"2026-08-14" }
  ,{ modelId:"amaran-t2c", brand:"Amaran", model:"T2c", cct:5600, distanceM:1, bareLux:475, modifierLux:null, modifier:"无附件", source:"https://docs.aputure.com/hubfs/Knowledge%20Base/amaran/T4c%20and%20T2c/All%20Files/T2C-Manual-EN_220316.pdf", verifiedAt:"2026-08-14" }
  ,{ modelId:"amaran-f21c", brand:"Amaran", model:"F21c", cct:5600, distanceM:1, bareLux:3360, modifierLux:2048, modifier:"官方软箱", source:"https://help.aputure.com/en/amaran-flexible-lights/photometrics-and-technical-specifications", verifiedAt:"2026-08-14" }
  ,{ modelId:"smallrig-350", brand:"SmallRig", model:"RC 350", cct:5600, distanceM:1, bareLux:null, modifierLux:115000, modifier:"官方反光罩", source:"https://www.smallrig.com/global/blog/enhance-your-lighting-setup-with-smallrig-cob-led-video-lights", verifiedAt:"2026-08-14" }
];

export function outputLuxAtDistance(light:VerifiedLight,distanceM:number,useModifier:boolean) { const base=useModifier?light.modifierLux:light.bareLux; return base===null?null:base*(light.distanceM/distanceM)**2; }
