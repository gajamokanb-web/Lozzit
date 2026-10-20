import React from 'react';
import { Image } from 'react-native';
import { FOOD_ICONS, FOOD_ICON_LIST } from './iconAssets';

export { FOOD_ICON_LIST };

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe');

/** icon key → words (French first, some English) that suggest it. The longest match in the name wins. */
const KW: [string, string][] = [
  ['alcohol', 'alcool whisky vodka rhum gin cognac liqueur biere armagnac calvados pastis'],
  ['almond', 'amande'], ['almond_butter', "puree d'amande|"],
  ['apple', 'pomme'], ['apple_granny_smith', 'granny'], ['applesauce', 'compote'],
  ['artichoke', 'artichaut'], ['asparagus', 'asperge'], ['avocado', 'avocat'],
  ['bagel_sesame', 'bagel'], ['baguette', 'baguette pain'], ['baked_beans', 'haricot blanc|haricots blancs|haricots rouges|haricot rouge|feve|pois chiche|lentille|flageolet|haricots secs'],
  ['balsamic_vinaigrette', 'vinaigrette vinaigre'], ['bamboo', 'bambou'], ['banana', 'banane'], ['banana_pepper', 'piment doux|'],
  ['broccoli', 'brocoli'], ['brownie', 'brownie fondant'], ['brussels_sprout', 'chou de bruxelles|'], ['burrito', 'burrito'],
  ['butter', 'beurre fromage emmental gruyere comte camembert brie chevre mozzarella parmesan cheddar raclette roquefort edam gouda cantal'],
  ['cabbage', 'chou'], ['cake', 'gateau cake genoise madeleine financier moelleux tiramisu fondant'],
  ['cauliflower', 'chou-fleur|chou fleur'], ['celery', 'celeri'],
  ['cereal', 'cereale muesli granola flocon'], ['cereal_bar', 'barre cerealiere|barre'], ['cereal_corn_flakes', 'corn flakes|mais souffle'], ['cereal_cheerios', 'cheerios'], ['cereal_fruit_loops', 'fruit loops'],
  ['chocolate_chips', 'chocolat pepite cacao'], ['chocolate_syrup', 'nappage chocolat|sirop de chocolat|pate a tartiner|nutella'],
  ['churro', 'churro'], ['cider', 'cidre|jus de pomme'], ['cinnamon_roll', 'cannelle|roule|brioche|pain au raisin'],
  ['clam', 'palourde coquillage moule huitre coque coquille saint-jacques'], ['coconut', 'noix de coco|coco'], ['coffee', 'cafe expresso'],
  ['coleslaw', 'coleslaw|salade de chou'], ['cookie', 'cookie|biscuit|sable|galette|petit-beurre|petit beurre|speculoos'], ['cookie_christmas', 'noel|pain d\'epice'],
  ['corn', 'mais'], ['cornbread', 'polenta'], ['cottage_cheese', 'fromage blanc|faisselle|cottage|petit-suisse|petit suisse|ricotta'],
  ['crab', 'crabe tourteau araignee'], ['cracker', 'cracker biscotte gressin'], ['cranberry', 'canneberge cranberry airelle groseille cassis myrtille'],
  ['cream', 'creme|lait concentre'], ['croissant', 'croissant|pain au chocolat|viennoiserie'], ['croutons', 'crouton'], ['crumpet', 'muffin anglais|blini'],
  ['cucumber', 'concombre'], ['cupcake', 'cupcake'], ['curry', 'curry'], ['date', 'datte'], ['default', ''],
  ['deli_meat', 'jambon|charcuterie|mortadelle|bacon|lard|poitrine fumee|rillettes|terrine|pate de campagne|pate de foie|bresaola|coppa'],
  ['dip_green', 'guacamole'], ['dip_red', 'houmous tapenade tzatziki'], ['dish', 'plat prepare'],
  ['donut', 'donut beignet'], ['dumpling', 'gyoza|ravioli chinois|dim sum|raviolis chinois'],
  ['eclair', 'eclair religieuse profiterole'], ['egg', 'oeuf'], ['egg_roll', 'rouleau imperial|'], ['eggplant', 'aubergine'], ['enchilada', 'enchilada'],
  ['falafel', 'falafel'], ['fern', 'fougere'], ['fig', 'figue'], ['filbert', 'noisette'], ['fish', 'poisson saumon thon cabillaud colin truite sardine maquereau hareng merlu lieu dorade bar sole anchois morue raie flet'],
  ['fowl', 'canard oie pintade caille pigeon'], ['french_fries', 'frites'], ['french_toast', 'pain perdu'], ['fritter', 'croquette'],
  ['frosting', 'glacage'], ['fruit_cocktail', 'macedoine salade de fruits|cocktail de fruits|fruits au sirop'], ['fruit_leather', 'pate de fruit|'],
  ['game', 'gibier lapin cerf sanglier chevreuil lievre'], ['garlic', 'ail'], ['gobo_root', 'salsifis bardane'], ['gourd', 'gourde'],
  ['graham_cracker', 'biscuit complet'], ['grain', 'ble orge avoine seigle epeautre boulgour quinoa semoule son millet sarrasin'],
  ['grapefruit', 'pamplemousse'], ['grapes', 'raisin'], ['grilled_cheese', 'croque'], ['guava', 'goyave'], ['gummy_bear', 'bonbon confiserie caramel gommes'],
  ['hamburger', 'hamburger burger cheeseburger'], ['hamburger_bun', 'pain a hamburger|pain burger'], ['hamburger_patty', 'steak hache|viande hachee'],
  ['hash', 'hachis'], ['hazelnut', 'hazelnut'], ['honey', 'miel'], ['horseradish', 'raifort'], ['hot_dog', 'hot dog|hot-dog'], ['hot_pot', 'pot-au-feu|fondue'],
  ['ice_cream', 'glace|creme glacee|sorbet'], ['ice_cream_bar', 'esquimau batonnet'], ['iced_coffee', 'cafe glace|'], ['iced_tea', 'the glace|the froid|ice tea'],
  ['jam', 'confiture gelee marmelade'], ['jicama', 'jicama'], ['juice', 'jus'], ['juice_orange', "jus d'orange|jus orange"],
  ['kale', 'chou frise|kale|chou kale'], ['kebab', 'kebab brochette'], ['ketchup', 'ketchup'], ['kiwi', 'kiwi'],
  ['lamb', 'agneau mouton gigot'], ['lasagna', 'lasagne'], ['latte', 'cappuccino|latte|cafe au lait'], ['leeks', 'poireau'],
  ['lemon', 'citron'], ['lemonade', 'citronnade limonade'], ['lime', 'citron vert|lime'], ['lobster', 'homard langouste langoustine ecrevisse'],
  ['mac_and_cheese', 'macaroni|gratin de pates'], ['macadamia', 'macadamia'], ['mango', 'mangue'], ['marshmallow', 'guimauve'], ['mayonnaise', 'mayonnaise'],
  ['meatballs', 'boulette'], ['melon', 'melon'], ['milk', 'lait'], ['milkshake', 'milkshake'], ['mixed_drink', 'cocktail'], ['mixed_nuts', 'fruits a coque|noix melangees|cacahuete'],
  ['muffin', 'muffin'], ['mushroom', 'champignon cepe girolle'], ['mustard', 'moutarde'], ['nigiri_sushi', 'nigiri sashimi'], ['octopus', 'poulpe pieuvre calamar encornet seiche'],
  ['oil', 'huile'], ['okra', 'gombo'], ['olive_black', 'olive noire'], ['olive_green', 'olive'], ['omelette', 'omelette'], ['onion', 'oignon'], ['orange', 'orange clementine mandarine'],
  ['orange_chicken', 'poulet curry|poulet orange'],
  ['pancakes', 'crepe pancake'], ['papaya', 'papaye'], ['parfait', 'parfait'], ['parsnip', 'panais'],
  ['pasta', 'pates spaghetti tagliatelle coquillette penne fusilli nouille vermicelle linguine'], ['pastry', 'patisserie tartelette'],
  ['pavlova', 'meringue pavlova'], ['peach', 'peche nectarine brugnon abricot'], ['peanut', 'arachide cacahuete'], ['peanut_butter', 'beurre de cacahuete|'], ['pear', 'poire'],
  ['peas', 'petits pois|petit pois|pois'], ['pecan', 'pecan'], ['peppers', 'poivron piment'], ['persimmon', 'kaki'], ['pickle', 'cornichon'],
  ['pie', 'tarte'], ['pie_apple', 'tarte aux pommes|'], ['pill', 'complement vitamine gelule medicament'], ['pine_nut', 'pignon'], ['pineapple', 'ananas'], ['pistachio', 'pistache'],
  ['pita_sandwich', 'pita|sandwich grec'], ['pizza', 'pizza'], ['plum', 'prune mirabelle quetsche reine-claude'], ['pomegranate', 'grenade'], ['popcorn', 'pop-corn|popcorn'],
  ['popsicle', 'glace a l\'eau|'], ['poptart', 'pop-tart'],
  ['pork', 'porc boeuf veau viande steak rosbif roti entrecote bavette rumsteck'], ['pork_chop', 'cote de porc|cotelette|escalope|cote'],
  ['pot_pie', 'tourte|pate en croute|feuillete'], ['potato', 'pomme de terre|patate'], ['potato_chip', 'chips'], ['potato_salad', 'salade de pommes de terre|'],
  ['powdered_drink', 'boisson en poudre|chocolat en poudre|whey|proteine'], ['prawn', 'gambas bouquet'], ['pretzel', 'bretzel'], ['prune', 'pruneau'],
  ['pudding', 'flan|creme dessert|pudding|mousse|riz au lait|semoule au lait'], ['pumpkin', 'potiron citrouille potimarron courge butternut'],
  ['quesadilla', 'quesadilla'], ['quiche', 'quiche'], ['radish', 'radis'], ['raisin', 'raisin sec|'], ['ranch_dressing', 'sauce salade|'], ['raspberry', 'framboise mure'],
  ['ravioli', 'raviolis ravioli tortellini'], ['recipe', 'recette'], ['relish', 'relish'], ['rhubarb', 'rhubarbe'], ['ribs', 'travers|cotes levees'], ['rice', 'riz'], ['rice_cake', 'galette de riz|'],
  ['roll', 'petit pain|'], ['roll_dinner', 'pain au lait|pain de campagne|pain complet'], ['romaine', 'salade verte|laitue|romaine|mache|roquette|endive|epinard cru'],
  ['salad', 'salade'], ['salad_dressing_balsamic', 'assaisonnement|sauce vinaigrette'], ['salt', 'sel'], ['sandwich', 'sandwich'], ['sauce', 'sauce coulis'],
  ['sausage', 'saucisse saucisson merguez chorizo'], ['seaweed', 'algue nori'], ['seed', 'graine sesame tournesol lin chia'], ['shallot', 'echalote'], ['shrimp', 'crevette'],
  ['smoothie', 'smoothie'], ['snack', 'snack'], ['snap_bean', 'haricot vert'], ['soft_serve_vanilla', 'glace a l\'italienne|'],
  ['souffle', 'souffle'], ['soup', 'soupe potage bouillon veloute'], ['soup_tomato', 'gazpacho'], ['sour_cream', 'creme fraiche|creme aigre'], ['soy_nut', 'soja'], ['soy_sauce', 'sauce soja|'],
  ['spice_brown', 'epice cannelle cumin muscade'], ['spice_green', 'persil basilic coriandre ciboulette menthe aneth herbe'], ['spice_red', 'paprika|piment de|safran'], ['spice_yellow', 'curcuma|moutarde en poudre'],
  ['spinach', 'epinard'], ['spring_roll', 'nem|rouleau de printemps'], ['sprouts', 'germe pousse'], ['squash', 'courge'], ['starfruit', 'carambole'],
  ['stew_brown', 'ragout bourguignon daube civet'], ['stew_yellow', 'blanquette fricassee'], ['stir_fry', 'saute wok'], ['stir_fry_noodles', 'nouilles sautees|'],
  ['strawberry', 'fraise'], ['stuffing', 'farce'], ['sub_sandwich', 'panini|baguette garnie'], ['sugar_brown', 'sucre roux|cassonade'], ['sugar_white', 'sucre'],
  ['sushi', 'sushi maki'], ['syrup', 'sirop'], ['taco', 'taco'], ['taro', 'taro'], ['tater_tots', 'rosti'], ['tea', 'the infusion tisane'], ['tempura', 'tempura'],
  ['toast', 'pain de mie|toast|tartine'], ['tofu', 'tofu'], ['tomato', 'tomate'], ['tortilla', 'tortilla'], ['tortilla_chip', 'nachos'], ['tostada', 'tostada'],
  ['turkey', 'dinde poulet volaille chapon coq'], ['turnip', 'navet|radis noir|betterave'], ['turnover', 'chausson'], ['vegetable', 'legume|jardiniere|ratatouille|carotte|macedoine de legumes'],
  ['waffles', 'gaufre'], ['walnut', 'noix'], ['water', 'eau'], ['water_chestnut', 'chataigne marron'], ['watermelon', 'pasteque'], ['white_bread', 'pain blanc|'],
  ['wine_red', 'vin rouge|vin'], ['wine_white', 'vin blanc|champagne|rose'], ['wrap', 'wrap'], ['yam', 'patate douce|igname|manioc'], ['yogurt', 'yaourt yoghourt skyr kefir'], ['zucchini', 'courgette'],
];

const TABLE: [string, RegExp, number][] = [];
for (const [key, words] of KW) {
  const list = words.includes('|') ? words.split('|') : words.split(' ');
  for (const w of list) {
    const t = norm(w).trim();
    if (!t) continue;
    TABLE.push([key, new RegExp(`(^|[^a-z])${t.replace(/[-\s]+/g, '[- ]').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), t.length]);
  }
}
// English names of the icons themselves ("Pizza", "Hot Dog" …)
for (const { key, name } of FOOD_ICON_LIST) {
  const t = norm(name.split(',')[0]);
  TABLE.push([key, new RegExp(`(^|[^a-z])${t.replace(/\s+/g, '[- ]')}`), t.length - 1]);
}

/** Best icon key for a food name, or undefined when nothing matches. */
export function suggestIcon(name: string): string | undefined {
  const n = norm(name);
  if (n.trim().length < 2) return undefined;
  let best: string | undefined;
  let bestLen = 0;
  for (const [key, re, len] of TABLE) if (len > bestLen && re.test(n)) { best = key; bestLen = len; }
  return best;
}

export function FoodIcon({ name, icon, size = 40 }: { name: string; icon?: string; size?: number }) {
  const key = icon && FOOD_ICONS[icon] ? icon : suggestIcon(name) ?? 'default';
  return <Image source={FOOD_ICONS[key]} style={{ width: size, height: size }} resizeMode="contain" />;
}
