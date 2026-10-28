'use strict';
/* Catalogue des fonctions : nom FR | nom EN (Excel) | catégorie | syntaxe | description */
const FONC_LISTE = `
SOMME|SUM|Math|SOMME(nombre1;[nombre2];…)|Additionne des nombres
PRODUIT|PRODUCT|Math|PRODUIT(nombre1;[nombre2];…)|Multiplie des nombres
ABS|ABS|Math|ABS(nombre)|Valeur absolue
ARRONDI|ROUND|Math|ARRONDI(nombre;décimales)|Arrondit à n décimales
ARRONDI.SUP|ROUNDUP|Math|ARRONDI.SUP(nombre;décimales)|Arrondit vers le haut
ARRONDI.INF|ROUNDDOWN|Math|ARRONDI.INF(nombre;décimales)|Arrondit vers le bas
ENT|INT|Math|ENT(nombre)|Partie entière (arrondi inférieur)
TRONQUE|TRUNC|Math|TRONQUE(nombre;[décimales])|Tronque les décimales
PLAFOND|CEILING|Math|PLAFOND(nombre;multiple)|Arrondit au multiple supérieur
PLANCHER|FLOOR|Math|PLANCHER(nombre;multiple)|Arrondit au multiple inférieur
MOD|MOD|Math|MOD(nombre;diviseur)|Reste de la division
QUOTIENT|QUOTIENT|Math|QUOTIENT(numérateur;dénominateur)|Quotient entier
PUISSANCE|POWER|Math|PUISSANCE(nombre;puissance)|Élève à une puissance
RACINE|SQRT|Math|RACINE(nombre)|Racine carrée
EXP|EXP|Math|EXP(nombre)|Exponentielle
LN|LN|Math|LN(nombre)|Logarithme népérien
LOG|LOG|Math|LOG(nombre;[base])|Logarithme (base 10 par défaut)
LOG10|LOG10|Math|LOG10(nombre)|Logarithme décimal
PI|PI|Math|PI()|Valeur de π
SIGNE|SIGN|Math|SIGNE(nombre)|Signe : -1, 0 ou 1
FACT|FACT|Math|FACT(nombre)|Factorielle
COMBIN|COMBIN|Math|COMBIN(n;k)|Nombre de combinaisons
PERMUT|PERMUT|Math|PERMUT(n;k)|Nombre de permutations
PGCD|GCD|Math|PGCD(nombre1;[nombre2];…)|Plus grand commun diviseur
PPCM|LCM|Math|PPCM(nombre1;[nombre2];…)|Plus petit commun multiple
DEGRES|DEGREES|Math|DEGRES(angle)|Radians vers degrés
RADIANS|RADIANS|Math|RADIANS(angle)|Degrés vers radians
SIN|SIN|Math|SIN(angle)|Sinus (angle en radians)
COS|COS|Math|COS(angle)|Cosinus (angle en radians)
TAN|TAN|Math|TAN(angle)|Tangente (angle en radians)
ASIN|ASIN|Math|ASIN(nombre)|Arc sinus
ACOS|ACOS|Math|ACOS(nombre)|Arc cosinus
ATAN|ATAN|Math|ATAN(nombre)|Arc tangente
ATAN2|ATAN2|Math|ATAN2(x;y)|Arc tangente de x et y
ALEA|RAND|Math|ALEA()|Nombre aléatoire entre 0 et 1
ALEA.ENTRE.BORNES|RANDBETWEEN|Math|ALEA.ENTRE.BORNES(min;max)|Entier aléatoire
SOMME.CARRES|SUMSQ|Math|SOMME.CARRES(nombre1;[nombre2];…)|Somme des carrés
SOMMEPROD|SUMPRODUCT|Math|SOMMEPROD(matrice1;[matrice2];…)|Somme des produits (notes × coefficients)
SOMME.SI|SUMIF|Math|SOMME.SI(plage;critère;[plage_somme])|Somme selon un critère
SOMME.SI.ENS|SUMIFS|Math|SOMME.SI.ENS(plage_somme;plage_crit1;crit1;…)|Somme selon plusieurs critères
SEQUENCE|SEQUENCE|Math|SEQUENCE(lignes;[colonnes];[début];[pas])|Génère une suite de nombres
MOYENNE|AVERAGE|Statistique|MOYENNE(nombre1;[nombre2];…)|Moyenne arithmétique
MOYENNE.SI|AVERAGEIF|Statistique|MOYENNE.SI(plage;critère;[plage_moyenne])|Moyenne selon un critère
MOYENNE.SI.ENS|AVERAGEIFS|Statistique|MOYENNE.SI.ENS(plage_moy;plage_crit1;crit1;…)|Moyenne selon plusieurs critères
MEDIANE|MEDIAN|Statistique|MEDIANE(nombre1;[nombre2];…)|Valeur médiane
MODE|MODE|Statistique|MODE(nombre1;[nombre2];…)|Valeur la plus fréquente
MIN|MIN|Statistique|MIN(nombre1;[nombre2];…)|Plus petite valeur
MAX|MAX|Statistique|MAX(nombre1;[nombre2];…)|Plus grande valeur
MIN.SI.ENS|MINIFS|Statistique|MIN.SI.ENS(plage_min;plage_crit1;crit1;…)|Minimum selon critères
MAX.SI.ENS|MAXIFS|Statistique|MAX.SI.ENS(plage_max;plage_crit1;crit1;…)|Maximum selon critères
NB|COUNT|Statistique|NB(valeur1;[valeur2];…)|Compte les nombres
NBVAL|COUNTA|Statistique|NBVAL(valeur1;[valeur2];…)|Compte les cellules non vides
NB.VIDE|COUNTBLANK|Statistique|NB.VIDE(plage)|Compte les cellules vides
NB.SI|COUNTIF|Statistique|NB.SI(plage;critère)|Compte selon un critère
NB.SI.ENS|COUNTIFS|Statistique|NB.SI.ENS(plage_crit1;crit1;…)|Compte selon plusieurs critères
ECARTYPE|STDEV|Statistique|ECARTYPE(nombre1;[nombre2];…)|Écart-type d’un échantillon
ECARTYPE.PEARSON|STDEV.P|Statistique|ECARTYPE.PEARSON(nombre1;[nombre2];…)|Écart-type d’une population
VAR|VAR|Statistique|VAR(nombre1;[nombre2];…)|Variance d’un échantillon
VAR.P|VAR.P|Statistique|VAR.P(nombre1;[nombre2];…)|Variance d’une population
QUARTILE|QUARTILE|Statistique|QUARTILE(données;quart)|Quartile (0 à 4)
CENTILE|PERCENTILE|Statistique|CENTILE(données;k)|Centile (k entre 0 et 1)
RANG|RANK|Statistique|RANG(nombre;plage;[ordre])|Rang dans une série
GRANDE.VALEUR|LARGE|Statistique|GRANDE.VALEUR(plage;k)|k-ième plus grande valeur
PETITE.VALEUR|SMALL|Statistique|PETITE.VALEUR(plage;k)|k-ième plus petite valeur
CORREL|CORREL|Statistique|CORREL(plage1;plage2)|Coefficient de corrélation
PENTE|SLOPE|Statistique|PENTE(y_connus;x_connus)|Pente de la droite de régression
ORDONNEE.ORIGINE|INTERCEPT|Statistique|ORDONNEE.ORIGINE(y_connus;x_connus)|Ordonnée à l’origine
PREVISION|FORECAST|Statistique|PREVISION(x;y_connus;x_connus)|Valeur prévue par régression linéaire
COEFFICIENT.DETERMINATION|RSQ|Statistique|COEFFICIENT.DETERMINATION(y_connus;x_connus)|Coefficient R²
MOYENNE.GEOMETRIQUE|GEOMEAN|Statistique|MOYENNE.GEOMETRIQUE(nombre1;[nombre2];…)|Moyenne géométrique
LOI.NORMALE.N|NORM.DIST|Statistique|LOI.NORMALE.N(x;moyenne;écart_type;cumulative)|Loi normale
LOI.NORMALE.STANDARD.N|NORM.S.DIST|Statistique|LOI.NORMALE.STANDARD.N(z;cumulative)|Loi normale centrée réduite
LOI.BINOMIALE.N|BINOM.DIST|Statistique|LOI.BINOMIALE.N(k;essais;proba;cumulative)|Loi binomiale
SI|IF|Logique|SI(test;valeur_si_vrai;[valeur_si_faux])|Renvoie une valeur selon une condition
SI.CONDITIONS|IFS|Logique|SI.CONDITIONS(test1;valeur1;test2;valeur2;…)|Plusieurs conditions successives
SI.MULTIPLE|SWITCH|Logique|SI.MULTIPLE(expression;val1;résultat1;…;[défaut])|Compare à une liste de valeurs
CHOISIR|CHOOSE|Logique|CHOISIR(numéro;valeur1;valeur2;…)|Choisit une valeur par son numéro
ET|AND|Logique|ET(test1;[test2];…)|Vrai si tous les tests sont vrais
OU|OR|Logique|OU(test1;[test2];…)|Vrai si un test est vrai
NON|NOT|Logique|NON(test)|Inverse un test
OUX|XOR|Logique|OUX(test1;[test2];…)|OU exclusif
SIERREUR|IFERROR|Logique|SIERREUR(valeur;valeur_si_erreur)|Remplace une erreur
SI.NON.DISP|IFNA|Logique|SI.NON.DISP(valeur;valeur_si_#N/A)|Remplace #N/A
VRAI|TRUE|Logique|VRAI()|Valeur logique vrai
FAUX|FALSE|Logique|FAUX()|Valeur logique faux
CONCATENER|CONCATENATE|Texte|CONCATENER(texte1;[texte2];…)|Assemble du texte
CONCAT|CONCAT|Texte|CONCAT(texte1;[texte2];…)|Assemble du texte et des plages
JOINDRE.TEXTE|TEXTJOIN|Texte|JOINDRE.TEXTE(séparateur;ignorer_vides;texte1;…)|Assemble avec un séparateur
GAUCHE|LEFT|Texte|GAUCHE(texte;[nb])|Premiers caractères
DROITE|RIGHT|Texte|DROITE(texte;[nb])|Derniers caractères
STXT|MID|Texte|STXT(texte;début;nb)|Extrait des caractères au milieu
NBCAR|LEN|Texte|NBCAR(texte)|Longueur du texte
MAJUSCULE|UPPER|Texte|MAJUSCULE(texte)|Met en majuscules
MINUSCULE|LOWER|Texte|MINUSCULE(texte)|Met en minuscules
NOMPROPRE|PROPER|Texte|NOMPROPRE(texte)|Première lettre de chaque mot en majuscule
SUPPRESPACE|TRIM|Texte|SUPPRESPACE(texte)|Supprime les espaces en trop
EPURAGE|CLEAN|Texte|EPURAGE(texte)|Supprime les caractères non imprimables
TROUVE|FIND|Texte|TROUVE(cherché;texte;[début])|Position d’un texte (sensible à la casse)
CHERCHE|SEARCH|Texte|CHERCHE(cherché;texte;[début])|Position d’un texte (insensible à la casse)
SUBSTITUE|SUBSTITUTE|Texte|SUBSTITUE(texte;ancien;nouveau;[n])|Remplace du texte
REMPLACER|REPLACE|Texte|REMPLACER(texte;début;nb;nouveau)|Remplace des caractères par position
REPT|REPT|Texte|REPT(texte;nombre)|Répète un texte
EXACT|EXACT|Texte|EXACT(texte1;texte2)|Compare deux textes (casse comprise)
TEXTE|TEXT|Texte|TEXTE(valeur;format)|Convertit en texte avec un format
VALEUR|VALUE|Texte|VALEUR(texte)|Convertit un texte en nombre
CAR|CHAR|Texte|CAR(code)|Caractère d’un code
CODE|CODE|Texte|CODE(texte)|Code du premier caractère
AUJOURDHUI|TODAY|Date et heure|AUJOURDHUI()|Date du jour
MAINTENANT|NOW|Date et heure|MAINTENANT()|Date et heure actuelles
DATE|DATE|Date et heure|DATE(année;mois;jour)|Construit une date
TEMPS|TIME|Date et heure|TEMPS(heure;minute;seconde)|Construit une heure
ANNEE|YEAR|Date et heure|ANNEE(date)|Année d’une date
MOIS|MONTH|Date et heure|MOIS(date)|Mois d’une date
JOUR|DAY|Date et heure|JOUR(date)|Jour d’une date
HEURE|HOUR|Date et heure|HEURE(heure)|Heure d’une valeur
MINUTE|MINUTE|Date et heure|MINUTE(heure)|Minute d’une valeur
SECONDE|SECOND|Date et heure|SECONDE(heure)|Seconde d’une valeur
JOURSEM|WEEKDAY|Date et heure|JOURSEM(date;[type])|Jour de la semaine (1 = dimanche)
NO.SEMAINE|WEEKNUM|Date et heure|NO.SEMAINE(date;[type])|Numéro de semaine
FIN.MOIS|EOMONTH|Date et heure|FIN.MOIS(date;mois)|Dernier jour du mois
MOIS.DECALER|EDATE|Date et heure|MOIS.DECALER(date;mois)|Décale d’un nombre de mois
JOURS|DAYS|Date et heure|JOURS(date_fin;date_début)|Nombre de jours entre deux dates
DATEDIF|DATEDIF|Date et heure|DATEDIF(début;fin;unité)|Différence en Y, M ou D
NB.JOURS.OUVRES|NETWORKDAYS|Date et heure|NB.JOURS.OUVRES(début;fin;[fériés])|Jours ouvrés entre deux dates
DATEVAL|DATEVALUE|Date et heure|DATEVAL(texte)|Convertit un texte en date
RECHERCHEV|VLOOKUP|Recherche|RECHERCHEV(valeur;table;n°_col;[exact])|Cherche dans la première colonne
RECHERCHEH|HLOOKUP|Recherche|RECHERCHEH(valeur;table;n°_ligne;[exact])|Cherche dans la première ligne
RECHERCHEX|XLOOKUP|Recherche|RECHERCHEX(valeur;plage_cherchée;plage_résultat;[si_absent])|Recherche moderne
EQUIV|MATCH|Recherche|EQUIV(valeur;plage;[type])|Position d’une valeur
INDEX|INDEX|Recherche|INDEX(plage;ligne;[colonne])|Valeur à une position
DECALER|OFFSET|Recherche|DECALER(réf;lignes;colonnes;[haut];[large])|Plage décalée
INDIRECT|INDIRECT|Recherche|INDIRECT(texte_réf)|Référence donnée sous forme de texte
LIGNE|ROW|Recherche|LIGNE([réf])|Numéro de ligne
COLONNE|COLUMN|Recherche|COLONNE([réf])|Numéro de colonne
LIGNES|ROWS|Recherche|LIGNES(plage)|Nombre de lignes
COLONNES|COLUMNS|Recherche|COLONNES(plage)|Nombre de colonnes
TRANSPOSE|TRANSPOSE|Recherche|TRANSPOSE(plage)|Échange lignes et colonnes
UNIQUE|UNIQUE|Recherche|UNIQUE(plage)|Valeurs uniques
TRIER|SORT|Recherche|TRIER(plage;[n°_col];[ordre])|Trie une plage
FILTRE|FILTER|Recherche|FILTRE(plage;condition;[si_vide])|Filtre une plage
MINIGRAPHIQUE|SPARKLINE|Recherche|MINIGRAPHIQUE(plage;[type])|Petit graphique dans la cellule
ESTVIDE|ISBLANK|Information|ESTVIDE(valeur)|Vrai si la cellule est vide
ESTNUM|ISNUMBER|Information|ESTNUM(valeur)|Vrai si c’est un nombre
ESTTEXTE|ISTEXT|Information|ESTTEXTE(valeur)|Vrai si c’est du texte
ESTLOGIQUE|ISLOGICAL|Information|ESTLOGIQUE(valeur)|Vrai si c’est un booléen
ESTERREUR|ISERROR|Information|ESTERREUR(valeur)|Vrai si c’est une erreur
ESTNA|ISNA|Information|ESTNA(valeur)|Vrai si c’est #N/A
ESTPAIR|ISEVEN|Information|ESTPAIR(nombre)|Vrai si le nombre est pair
ESTIMPAIR|ISODD|Information|ESTIMPAIR(nombre)|Vrai si le nombre est impair
N|N|Information|N(valeur)|Convertit en nombre
NA|NA|Information|NA()|Renvoie l’erreur #N/A
VPM|PMT|Financier|VPM(taux;npm;va;[vc];[type])|Mensualité d’un prêt
VA|PV|Financier|VA(taux;npm;vpm;[vc];[type])|Valeur actuelle
VC|FV|Financier|VC(taux;npm;vpm;[va];[type])|Valeur future
NPM|NPER|Financier|NPM(taux;vpm;va;[vc];[type])|Nombre de périodes
TAUX|RATE|Financier|TAUX(npm;vpm;va;[vc];[type])|Taux par période
VAN|NPV|Financier|VAN(taux;valeur1;[valeur2];…)|Valeur actuelle nette
TRI|IRR|Financier|TRI(valeurs;[estimation])|Taux de rentabilité interne
AMORLIN|SLN|Financier|AMORLIN(coût;valeur_résiduelle;durée)|Amortissement linéaire
`.trim().split('\n').map((l) => { const [fr, en, cat, syntaxe, desc] = l.split('|'); return { fr, en, cat, syntaxe, desc }; });

const FONC_PAR_FR = Object.fromEntries(FONC_LISTE.map((f) => [f.fr, f]));
const EN2FR = Object.fromEntries(FONC_LISTE.map((f) => [f.en, f.fr]));
const FR2EN = Object.fromEntries(FONC_LISTE.map((f) => [f.fr, f.en]));
// Alias Excel anglais supplémentaires
Object.assign(EN2FR, { CONCATENATE: 'CONCATENER', STDEV: 'ECARTYPE', 'STDEV.S': 'ECARTYPE', 'VAR.S': 'VAR', SEARCHB: 'CHERCHE', 'RANK.EQ': 'RANG', 'MODE.SNGL': 'MODE', 'PERCENTILE.INC': 'CENTILE', 'QUARTILE.INC': 'QUARTILE', 'CEILING.MATH': 'PLAFOND', 'FLOOR.MATH': 'PLANCHER' });
const CATEGORIES = ['Math', 'Statistique', 'Logique', 'Texte', 'Date et heure', 'Recherche', 'Information', 'Financier'];
