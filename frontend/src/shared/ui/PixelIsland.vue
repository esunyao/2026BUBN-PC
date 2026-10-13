<script setup lang="ts">
import { computed, useId } from 'vue'
import type { Theme } from '../types'

const props = defineProps<{ appearance: number; theme: Theme }>()
const uid = useId()
const kind = computed(() => ((props.appearance % 10) + 10) % 10)
const colors = computed(() =>
  props.theme === 'night'
    ? {
        grass: '#355f52',
        grassLight: '#467362',
        leaf: '#234d47',
        leafLight: '#396957',
        sand: '#8b9278',
        rock: '#53667b',
        rockDark: '#2c3d55',
        rockLight: '#718293',
        wall: '#859081',
        wallLight: '#acb1a0',
        roof: '#424e69',
        roofLight: '#66718e',
        timber: '#876945',
        timberLight: '#b08a57',
        light: '#ffcf79',
        water: '#539abb',
      }
    : {
        grass: '#7da965',
        grassLight: '#a6c882',
        leaf: '#3b795c',
        leafLight: '#70a26a',
        sand: '#e5d1a3',
        rock: '#8e9f9d',
        rockDark: '#607a83',
        rockLight: '#b8c3b0',
        wall: '#ebd9b0',
        wallLight: '#fff0cb',
        roof: '#b26a54',
        roofLight: '#d38a68',
        timber: '#997247',
        timberLight: '#d4a56b',
        light: '#f8df93',
        water: '#95e1e6',
      },
)
const symbol = (name: string) => '#' + uid + '-' + name
</script>

<template>
  <svg
    class="pixel-island"
    :class="{ night: theme === 'night' }"
    viewBox="0 0 240 200"
    shape-rendering="crispEdges"
    aria-hidden="true"
  >
    <defs>
      <g :id="uid + '-tree'">
        <path d="M-3-20h6V5h-6z" :fill="colors.timber" />
        <path d="M-18-34h7v-8h20v6h10v16h-6v7H-9v-6h-11z" :fill="colors.leaf" />
        <path d="M-15-34h8v-6H6v5h9v7H4v5h-19z" :fill="colors.leafLight" />
        <path d="M-9-37h9v4h-9zM7-27h7v4H7z" :fill="colors.grassLight" />
        <path d="M2-17h4v20H2z" :fill="colors.rockDark" opacity="0.5" />
      </g>
      <g :id="uid + '-pine'">
        <path d="M-3-17h6V6h-6z" :fill="colors.timber" />
        <path
          d="M-4-49h8v8h6v8h6v8h5v8h-6v7h7v8h-44v-8h7v-7h-6v-8h5v-8h6v-8h6z"
          :fill="colors.leaf"
        />
        <path d="M-4-45h5v13h-5zM-10-28H2v7h-12zM-15-10H2v7h-17z" :fill="colors.leafLight" />
      </g>
      <g :id="uid + '-palm'">
        <path d="M-3-7h6v12h-6zM0-23h5v17H0zM3-38h5v15H3z" :fill="colors.timber" />
        <path
          d="M1-41h-15v5h-10v7h-5v7h6v-7h10v-7H1zM6-42h13v5h10v7h5v8h-5v-8H18v-7H6zM3-44v-7h-7v-5h-12v5h10v7zM7-44v-9h12v-5h11v5H19v9z"
          :fill="colors.leaf"
        />
        <path d="M-15-40H4v4h-19zM10-41h15v4H10zM9-51h9v5H9z" :fill="colors.leafLight" />
      </g>
      <g :id="uid + '-lamp'">
        <path d="M-2-23h4V4h-4zM-5 4H5v3H-5zM-5-34H5v4h3v10H-8v-10h3z" :fill="colors.rockDark" />
        <path d="M-4-29h8v7h-8z" :fill="colors.light" />
        <rect
          v-if="theme === 'night'"
          x="-12"
          y="-37"
          width="24"
          height="24"
          rx="12"
          fill="#ffd180"
          opacity="0.13"
        />
      </g>
      <g :id="uid + '-rock'">
        <path d="M-10-9h5v-5H5v5h7V3h-22z" :fill="colors.rock" />
        <path d="M-10-9h6v10h-6zM4-12h5v14H4z" :fill="colors.rockDark" />
        <path d="M-5-12h8v4h-8z" :fill="colors.rockLight" />
      </g>
    </defs>

    <!-- The shoreline steps, three rock faces and dock create the shared depth. -->
    <path
      d="M29 135H15v-15H9V99h8V88h15V77h25v-8h111v6h25v9h21v13h15v24h-8v14h-19v9H47v-9z"
      fill="#032d47"
      opacity="0.17"
      transform="translate(0 13)"
    />
    <path
      d="M13 123H7v-22h8V87h16V77h29v-8h112v7h24v9h20v11h16v27h-12v15h-25v9H43v-9H23v-8H13z"
      :fill="colors.water"
      opacity="0.45"
    />
    <path
      d="M24 112V92h14V82h25v-8h105v6h28v10h18v18h10v21h-18v13h-35v7H67v-6H40v-12H24z"
      :fill="colors.rockDark"
    />
    <path
      d="M24 110h21v28h22v11H49v-6H38v-11H24zM67 112h25v37H67zM112 117h19v32h-19zM164 108h21v35h-21zM201 105h18v27h-18z"
      :fill="colors.rock"
    />
    <path
      d="M31 113h8v17h-8zM73 126h6v14h-6zM117 120h7v17h-7zM171 114h6v17h-6zM204 111h7v13h-7z"
      :fill="colors.rockLight"
    />
    <path
      d="M44 91V81h23v-7h98v6h25v9h20v13h8v14h-20v11h-34v7H77v-6H50v-9H31v-17z"
      :fill="colors.sand"
    />
    <path
      d="M44 94h13V84h26v-6h75v7h30v11h16v15h-19v9h-27v6H85v-7H59v-10H40z"
      :fill="kind === 2 || kind === 9 ? colors.sand : colors.grass"
    />
    <path
      d="M55 95h17v-7h21v-6h54v6h-35v5H83v10H55zM161 100h24v6h-24zM72 115h17v5H72z"
      :fill="colors.grassLight"
      :opacity="kind === 2 || kind === 9 ? 0.3 : 0.7"
    />
    <path d="M102 112h29v49h-29z" :fill="colors.timber" />
    <path
      d="M99 118h36v4H99zM99 128h36v4H99zM99 138h36v4H99zM99 148h36v4H99zM99 158h36v4H99z"
      :fill="colors.timberLight"
    />
    <path
      d="M99 117h4v50h-4zM131 117h4v50h-4zM98 165h7v6h-7zM129 165h7v6h-7z"
      :fill="colors.rockDark"
    />
    <use :href="symbol('rock')" x="43" y="129" />
    <use :href="symbol('rock')" x="192" y="133" />
    <path
      d="M24 151h21v3H24zM62 159h21v3H62zM152 160h29v3h-29zM202 143h18v3h-18z"
      :fill="colors.water"
      opacity="0.8"
    />

    <!-- Station: clock tower, red train and raised rails. -->
    <g v-if="kind === 0">
      <use :href="symbol('tree')" x="51" y="93" />
      <use :href="symbol('tree')" x="191" y="93" />
      <path d="M61 56h110v47H61z" :fill="colors.wall" />
      <path d="M61 57h15v46H61zM154 57h17v46h-17z" :fill="colors.timber" />
      <path d="M53 54h6v-7h16v-8h83v8h17v7h5v8H53z" :fill="colors.roof" />
      <path d="M70 48h86v4H70zM62 54h103v4H62z" :fill="colors.roofLight" />
      <path d="M109 28h25v74h-25z" :fill="colors.wallLight" />
      <path d="M104 26h5v-8h6V9h13v9h6v8h5v5h-35z" :fill="colors.roof" />
      <rect x="114" y="38" width="15" height="15" fill="#f4e8c9" />
      <path d="M121 40v7h5v2h-7v-9z" :fill="colors.rockDark" />
      <path d="M84 69h15v16H84zM140 69h11v16h-11zM116 69h13v30h-13z" :fill="colors.rockDark" />
      <path d="M85 70h12v8H85zM141 70h9v8h-9z" :fill="colors.light" />
      <path d="M39 111h153v4H39zM43 120h146v4H43z" :fill="colors.rockDark" />
      <path d="M49 104h49v16H49zM52 99h39v6H52z" fill="#bd614d" />
      <path d="M54 106h9v7h-9zM68 106h9v7h-9zM82 106h10v7H82z" :fill="colors.light" />
      <path d="M54 118h8v5h-8zM84 118h8v5h-8z" :fill="colors.rockDark" />
    </g>

    <!-- Guesthouse: two roof volumes, balcony and flowering trees. -->
    <g v-else-if="kind === 1">
      <use :href="symbol('tree')" x="49" y="90" />
      <use :href="symbol('tree')" x="193" y="100" />
      <path d="M66 53h94v51H66z" :fill="colors.wall" />
      <path d="M134 60h36v44h-36z" :fill="colors.wallLight" />
      <path d="M54 57h9v-8h10v-8h12v-8h50v8h12v8h12v8h9v7H54z" :fill="colors.roof" />
      <path d="M65 53h82v4H65zM77 44h58v4H77z" :fill="colors.roofLight" />
      <path d="M128 57h8v-8h12v-8h11v8h12v8h8v7h-51z" :fill="colors.roof" />
      <path d="M91 23h13v21H91z" :fill="colors.rock" />
      <path
        d="M75 69h17v17H75zM108 69h17v17h-17zM144 69h16v17h-16zM106 91h19v15h-19z"
        :fill="colors.timber"
      />
      <path d="M78 71h11v12H78zM111 71h11v12h-11zM147 71h10v12h-10z" :fill="colors.light" />
      <path
        d="M69 88h94v4H69zM71 84h3v15h-3zM85 84h3v15h-3zM137 84h3v15h-3zM156 84h3v15h-3zM69 97h94v4H69z"
        :fill="colors.timber"
      />
      <path d="M47 71h6v6h-6zM54 64h6v6h-6zM183 74h7v7h-7zM194 64h6v6h-6z" fill="#dcadab" />
      <path d="M86 107h62v5H86zM93 113h48v5H93z" :fill="colors.rockLight" />
    </g>

    <!-- Beach: palms, striped parasol, cabin and surfboards. -->
    <g v-else-if="kind === 2">
      <use :href="symbol('palm')" x="49" y="91" />
      <use :href="symbol('palm')" x="193" y="95" />
      <use :href="symbol('palm')" x="163" y="78" />
      <path d="M74 67h39v36H74z" :fill="colors.timberLight" />
      <path d="M65 66h8v-9h10v-9h23v9h10v9h7v6H65z" :fill="colors.timber" />
      <path d="M77 63h34v4H77zM84 54h20v4H84z" :fill="colors.sand" />
      <path d="M82 80h14v23H82zM101 79h8v12h-8z" :fill="colors.rockDark" />
      <path d="M141 93h3v28h-3z" :fill="colors.timber" />
      <path d="M118 94v-5h6v-6h12v-5h13v5h11v6h6v5z" fill="#e5b469" />
      <path d="M134 83h5v-5h7v5h5v11h-17z" fill="#f2ede0" />
      <path
        d="M151 107h23v5h-23zM157 112h22v4h-22zM65 109h21v6H65zM60 115h20v4H60z"
        :fill="colors.wallLight"
      />
      <path d="M183 90h7v24h-7zM185 86h3v4h-3z" fill="#85bbc3" />
      <path d="M199 96h7v23h-7zM201 92h3v4h-3z" fill="#d88773" />
    </g>

    <!-- Lighthouse: tall striped tower on a rock ledge. -->
    <g v-else-if="kind === 3">
      <use :href="symbol('pine')" x="65" y="96" />
      <use :href="symbol('tree')" x="185" y="97" />
      <path d="M98 89h43v16H98zM106 30h29v60h-29zM111 16h19v15h-19z" :fill="colors.wallLight" />
      <path d="M106 43h29v12h-29zM106 70h29v12h-29z" fill="#b96e62" />
      <path d="M127 30h8v60h-8z" :fill="colors.rockDark" opacity="0.25" />
      <path d="M105 14h5V8h5V2h11v6h6v6h5v4h-32z" :fill="colors.roof" />
      <path d="M109 19h23v10h-23z" :fill="colors.rockDark" />
      <path d="M113 20h6v7h-6zM123 20h5v7h-5z" :fill="colors.light" />
      <path v-if="theme === 'night'" d="M129 21l76-18v39l-76-17z" fill="#ffdf98" opacity="0.15" />
      <path d="M114 90h12v15h-12z" :fill="colors.timber" />
      <path d="M146 84h33v21h-33zM141 83h5v-7h13v-7h9v7h11v7h6v5h-44z" :fill="colors.roof" />
      <path d="M149 88h27v16h-27z" :fill="colors.wall" />
      <path d="M158 90h9v8h-9z" :fill="colors.light" />
      <path d="M85 107h60v5H85zM95 114h40v4H95z" :fill="colors.rockLight" />
    </g>

    <!-- Forest: layered conifers, canvas tent and a campfire. -->
    <g v-else-if="kind === 4">
      <use
        v-for="tree in [
          { x: 57, y: 98 },
          { x: 85, y: 78 },
          { x: 122, y: 74 },
          { x: 154, y: 81 },
          { x: 186, y: 103 },
        ]"
        :key="tree.x"
        :href="symbol('pine')"
        :x="tree.x"
        :y="tree.y"
      />
      <path d="M72 112v-7h7V95h8V85h10v10h10v10h7v7z" fill="#d4b176" />
      <path d="M96 85h7v10h10v10h7v7h-24z" fill="#a87b57" />
      <path d="M85 112v-9h6v-8h5v17z" :fill="colors.rockDark" />
      <path d="M137 117h29v4h-29zM143 122h18v4h-18z" :fill="colors.timber" />
      <path d="M147 116v-8h4v-10h5v8h5v10z" fill="#e59a50" />
      <path d="M151 116v-8h5v8z" fill="#ffe297" />
      <circle v-if="theme === 'night'" cx="153" cy="110" r="23" fill="#ffd17a" opacity="0.12" />
      <use :href="symbol('rock')" x="45" y="118" />
    </g>

    <!-- Market: plaza fountain, three awnings and stacked crates. -->
    <g v-else-if="kind === 5">
      <path d="M59 90h125v29H59zM79 81h86v39H79z" :fill="colors.rockLight" />
      <g
        v-for="stall in [
          { x: 51, y: 68, color: '#b76957' },
          { x: 119, y: 48, color: '#668997' },
          { x: 155, y: 83, color: '#c09b5d' },
        ]"
        :key="stall.x"
        :transform="'translate(' + stall.x + ',' + stall.y + ')'"
      >
        <path d="M0 8h40v26H0z" :fill="colors.timber" />
        <path d="M-4 6h4V0h40v6h4v7H-4z" :fill="stall.color" />
        <path d="M5 0h6v13H5zM20 0h6v13h-6zM35 0h5v13h-5z" :fill="colors.wallLight" />
        <path d="M5 18h30v8H5z" :fill="colors.rockDark" />
        <path d="M8 18h7v5H8zM19 18h7v5h-7zM29 18h5v5h-5z" :fill="colors.grassLight" />
      </g>
      <path d="M98 106h39v10H98zM104 99h27v8h-27z" :fill="colors.rockDark" />
      <path d="M103 106h29v6h-29zM114 83h7v23h-7zM109 86h17v5h-17z" :fill="colors.water" />
      <use :href="symbol('lamp')" x="47" y="110" />
      <use :href="symbol('lamp')" x="189" y="115" />
    </g>

    <!-- Coffee house: oversized rooftop cup, terrace and two tables. -->
    <g v-else-if="kind === 6">
      <use :href="symbol('tree')" x="53" y="92" />
      <use :href="symbol('tree')" x="194" y="95" />
      <path d="M72 56h95v49H72z" :fill="colors.timber" />
      <path d="M63 52h112v10H63zM72 43h95v9H72z" :fill="colors.roof" />
      <path d="M75 48h89v4H75z" :fill="colors.roofLight" />
      <path d="M81 69h24v24H81zM135 69h24v24h-24zM113 69h15v36h-15z" :fill="colors.light" />
      <path
        d="M92 69h3v24h-3zM146 69h3v24h-3zM81 81h24v3H81zM135 81h24v3h-24z"
        :fill="colors.timber"
      />
      <path d="M105 24h27v19h-5v5h-17v-5h-5zM132 26h8v13h-8v-4h4v-5h-4z" :fill="colors.wallLight" />
      <path d="M108 24h21v4h-21z" :fill="colors.rockDark" />
      <path d="M112 13h3v7h-3zM123 8h3v11h-3z" :fill="colors.wallLight" opacity="0.65" />
      <path d="M56 106h126v7H56zM60 115h118v4H60z" :fill="colors.timberLight" />
      <path
        d="M65 107h25v4H65zM73 111h4v10h-4zM149 107h25v4h-25zM157 111h4v10h-4z"
        :fill="colors.wallLight"
      />
      <use :href="symbol('lamp')" x="182" y="116" />
    </g>

    <!-- Cliff: high rock terraces, falls and a tiny lookout. -->
    <g v-else-if="kind === 7">
      <path d="M60 63h15V48h30V37h52v10h24v17h13v49h-14v12h-28v9H88v-12H61z" :fill="colors.rock" />
      <path
        d="M60 64h21v59H60zM89 55h21v72H89zM149 49h14v77h-14zM177 63h17v51h-17z"
        :fill="colors.rockDark"
      />
      <path
        d="M66 72h7v22h-7zM96 61h7v35h-7zM152 58h7v22h-7zM180 69h7v24h-7z"
        :fill="colors.rockLight"
      />
      <path d="M60 64V54h19V43h26V34h52v10h25v14h11v8h-34v8h-44v-7z" :fill="colors.grass" />
      <path d="M117 61h20v69h-20zM112 126h29v9h-29zM102 137h47v5h-47z" :fill="colors.water" />
      <path d="M120 65h5v62h-5zM132 79h3v52h-3zM110 137h24v3h-24z" fill="#d1f1e9" opacity="0.8" />
      <use :href="symbol('pine')" x="92" y="56" />
      <path
        d="M137 49h45v4h-45zM140 35h4v17h-4zM158 35h4v17h-4zM178 35h4v17h-4zM137 37h45v3h-45z"
        :fill="colors.timberLight"
      />
      <use :href="symbol('lamp')" x="173" y="45" />
    </g>

    <!-- Music: stage, lights, speakers and seated audience. -->
    <g v-else-if="kind === 8">
      <use :href="symbol('palm')" x="49" y="89" />
      <use :href="symbol('palm')" x="191" y="95" />
      <path d="M63 93h114v15H63zM69 57h102v36H69z" :fill="colors.timber" />
      <path d="M76 61h89v32H76z" :fill="colors.rockDark" />
      <path d="M62 52h113v7H62zM67 56h6v39h-6zM165 56h6v39h-6z" :fill="colors.timberLight" />
      <path
        d="M81 60h6v5h-6zM98 62h6v5h-6zM115 64h6v5h-6zM132 62h6v5h-6zM149 60h6v5h-6z"
        :fill="colors.light"
      />
      <path d="M81 77h12v17H81zM147 77h12v17h-12z" fill="#283845" />
      <path d="M83 80h8v4h-8zM149 80h8v4h-8zM83 88h8v4h-8zM149 88h8v4h-8z" :fill="colors.rock" />
      <path d="M105 78h13v13h-13zM126 80h13v11h-13z" fill="#c99169" />
      <path d="M108 71h6v7h-6zM129 73h6v7h-6z" :fill="colors.sand" />
      <path d="M81 113h21v5H81zM112 118h21v5h-21zM143 112h21v5h-21z" :fill="colors.timber" />
      <path d="M87 105h6v9h-6zM119 110h6v9h-6zM150 104h6v9h-6z" :fill="colors.wallLight" />
      <path
        v-if="theme === 'night'"
        d="M85 65l-8 25h23zM151 65l-13 25h24z"
        fill="#ffd17a"
        opacity="0.12"
      />
    </g>

    <!-- Pier: timber promenade, gazebo and mooring posts. -->
    <g v-else>
      <use :href="symbol('palm')" x="59" y="92" />
      <path d="M70 88h126v38H70zM87 75h96v14H87z" :fill="colors.timber" />
      <path
        d="M71 92h124v4H71zM71 102h124v4H71zM71 112h124v4H71zM71 122h124v4H71z"
        :fill="colors.timberLight"
      />
      <path
        d="M133 58h5v35h-5zM173 58h5v35h-5zM125 57h61v6h-61zM132 50h48v7h-48zM141 43h30v7h-30zM151 36h10v7h-10z"
        :fill="colors.roof"
      />
      <path d="M138 63h35v4h-35z" :fill="colors.timberLight" />
      <path
        d="M68 82h4v50h-4zM94 80h4v13h-4zM191 80h4v52h-4zM70 83h60v4H70zM181 83h14v4h-14z"
        :fill="colors.timberLight"
      />
      <use :href="symbol('lamp')" x="80" y="111" />
      <use :href="symbol('lamp')" x="184" y="117" />
      <path d="M144 98h28v4h-28zM147 103h4v9h-4zM166 103h4v9h-4z" :fill="colors.wallLight" />
      <path d="M79 126h6v15h-6zM176 126h6v15h-6z" :fill="colors.rockDark" />
    </g>
  </svg>
</template>

<style scoped>
.pixel-island {
  width: 240px;
  height: 200px;
  overflow: visible;
  filter: drop-shadow(0 8px 0 #123b4512);
}
.night {
  filter: drop-shadow(0 8px 0 #030e2a40);
}
</style>
