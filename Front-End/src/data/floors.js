// Floor-plan drawings. Coordinates are PIXELS on a 1598 x 682 drawing,
// the same system as location.x / location.y. Gates, shops, WC... are NOT drawn here:
// they are locations (data) and MapView draws them as markers.
const floors = [
    {
        id: 0,
        terminal: "T1",
        name: "Tầng Trệt",
        svg: `
            <g stroke="#cecece" stroke-width="2" stroke-linejoin="round">
                <polygon fill="#fff" points="70,192 1177,192 1177,259 1399,259 1399,488 1385,488 1385,522 1177,522 1177,569 1160,569 1160,592 353,592 353,570 163,570 163,272 70,272"/>
                <polygon fill="#d8dada" points="353,500 1177,500 1177,285 1399,285 1399,488 1385,488 1385,522 1177,522 1177,569 1160,569 1160,592 353,592"/>
                <path fill="#cce2ef" d="M163 294h200v106h-200zM353 304h350v57H353zM353 448h565v52H353z"/>
                <path fill="#ece3e3" d="M720 300h250v90H720zM259 322h70v50h-70z"/>
                <path fill="#e3eadb" d="M164 260h55v34h-55zM1020 380h80v50h-80z"/>
            </g>
            <text x="520" y="340" font-size="13" font-weight="700">GA ĐẾN · BĂNG CHUYỀN HÀNH LÝ & CHECK-IN</text>
        `
    },
    {
        id: 1,
        terminal: "T1",
        name: "Tầng 1",
        svg: `
            <g stroke="#cecece" stroke-width="2" stroke-linejoin="round">
                <polygon fill="#fff" points="70,192 231,192 231,96 246,96 246,192 533,192 533,96 547,96 547,192 853,192 853,96 868,96 868,192 1165,192 1165,96 1177,96 1177,259 1399,259 1399,488 1385,488 1385,522 1177,522 1177,569 1160,569 1160,592 353,592 353,570 163,570 163,272 70,272"/>
                <polygon fill="#d8dada" points="353,500 917,500 917,416 1048,416 1048,500 1177,500 1177,285 1399,285 1399,488 1385,488 1385,522 1177,522 1177,569 1160,569 1160,592 353,592"/>
                <polygon fill="#d8dada" points="373,361 441,361 441,374 599,374 599,303 651,303 651,422 373,422"/>
                <path fill="#cce2ef" d="M70 192h139v80H70zM163 294h58v106h-58zM353 304h246v57H353zM353 448h565v52H353zM1049 450h128v50h-128z"/>
                <path fill="#d6d3e9" d="M234 238h68v16h-68zM412 238h273v16H412zM789 292h76v68h-76zM761 384h105v42H761zM997 276h28v-27h72v49h50v126h-74V307h-48v-13h-28z"/>
                <path fill="#ece3e3" d="M259 322h49v34h-49zM652 304h103v49H652zM671 354h62v68h-62zM889 258h21v160h-21zM960 330h98v85h-98z"/>
                <path fill="#e3eadb" d="M164 260h45v34h-45zM353 378h20v44h-20zM690 316h33v37h-33zM1025 398h22v38h-22z"/>
                <path fill="#e0a084" d="M282 436h49v-14h22v148h-71z"/>
                <path d="M209 194H1177M212 204H1177M239 96v98M540 96v98M860 96v98M1171 96v98" fill="none"/>
            </g>
            <text x="575" y="337" font-size="11" font-weight="700">KHU DỊCH VỤ</text>
        `
    },
    {
        id: 2,
        terminal: "T1",
        name: "Tầng 2",
        svg: `
            <g stroke="#c9ced1" stroke-width="2" stroke-linejoin="round">
                <polygon fill="#fff" points="163,192 1177,192 1177,285 1280,285 1280,500 1177,500 1177,550 260,550 260,500 163,500"/>
                <rect x="260" y="300" width="820" height="160" fill="#edf0f1"/>
                <rect x="310" y="325" width="180" height="110" fill="#cce2ef"/>
                <rect x="515" y="325" width="190" height="110" fill="#d6d3e9"/>
                <rect x="730" y="325" width="160" height="110" fill="#ece3e3"/>
                <rect x="915" y="325" width="215" height="110" fill="#d6d3e9"/>
                <path d="M163 240h1014M260 460h917" fill="none"/>
            </g>
            <text x="720" y="226" font-size="22" font-weight="700">TẦNG 2 · MẶT BẰNG MẪU</text>
        `
    }
];

export default floors;
