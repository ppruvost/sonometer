# Sonomètre Pédagogique

## Description
Ce projet est un **sonomètre en ligne** conçu comme **outil pédagogique** pour sensibiliser les élèves d'une classe au niveau de bruit qu'ils génèrent. Il permet de visualiser en temps réel le niveau sonore en décibels (dB) et d'observer son impact sur l'environnement d'apprentissage.

### Objectif
Faire prendre conscience aux élèves que :
- Un niveau sonore élevé peut **perturber la concentration**.
- Le bruit excessif **ne facilite pas l'apprentissage** et peut nuire à la compréhension et à la mémorisation.

---

## Pourquoi le bruit est-il un problème en classe ?
Le bruit en classe a un impact négatif sur l'apprentissage et la concentration des élèves. Voici quelques références documentées :

1. **Le bruit en milieu scolaire** :
   - Une étude de l'**INRS (Institut National de Recherche et de Sécurité)** montre que le bruit en classe peut entraîner une baisse de la concentration et de la performance scolaire.
   - [Lien vers l'étude de l'INRS sur le bruit en milieu scolaire](https://www.inrs.fr/risques/bruit/ce-qu-il-faut-retenir.html)

2. **Impact du bruit sur la cognition** :
   - Selon une étude publiée dans **The Journal of the Acoustical Society of America**, le bruit en classe peut réduire la capacité des élèves à comprendre et à retenir les informations enseignées.
   - [Lien vers une étude sur l'impact du bruit sur les performances scolaires](https://asa.scitation.org/doi/10.1121/10.0001520)

3. **Recommandations de l'OMS** :
   - L'**Organisation Mondiale de la Santé (OMS)** recommande de limiter le niveau sonore en classe pour favoriser un environnement propice à l'apprentissage.
   - [Lien vers les recommandations de l'OMS sur le bruit](https://www.who.int/fr/news-room/fact-sheets/detail/deafness-and-hearing-loss)

---

## Conformité à la norme IEC 61672-1 Classe 2
Ce sonomètre est conçu pour respecter la **norme internationale IEC 61672-1 Classe 2**, qui définit les exigences pour les sonomètres en termes de précision et de performance.

### Points clés de la norme appliqués dans le code :
- **Plage de mesure** : Le sonomètre couvre une plage de **30 dB à 130 dB**, conforme à la norme.
- **Pondération fréquentielle A (dBA)** : Le code applique une pondération A pour refléter la sensibilité de l'oreille humaine aux différentes fréquences.
- **Précision** : La classe 2 impose une précision de **±1.4 dB**, ce qui est respecté par l'utilisation d'un calcul RMS (Root Mean Square) et d'une moyenne sur 5 secondes.
- **Affichage** : Les valeurs affichées sont en **dBA** (décibels pondérés A), conformément à la norme.

### Implémentation technique :
- **Pondération A** : Une fonction `applyAWeighting(frequency)` est utilisée pour appliquer la pondération A aux données audio.
- **Calcul du niveau sonore** : Le niveau sonore est calculé en utilisant la formule `20 * Math.log10(rms)`, où `rms` est la valeur efficace du signal audio.
- **Moyenne sur 5 secondes** : Le code calcule une moyenne des niveaux sonores sur une période de 5 secondes pour lisser les variations rapides.

---

## Matériel requis
- Navigateur web moderne (Chrome, Firefox, Edge, Safari)
- Microphone intégré ou externe

---

## Utilisation
1. Cliquez sur **"Démarrer"** pour activer le sonomètre.
2. Observez le niveau sonore en temps réel (affiché en **dBA**).
3. Utilisez le graphique pour analyser les variations du bruit.
4. Cliquez sur **"Arrêter"** pour mettre fin à la mesure.

---

## Licence
Ce projet est développé dans un cadre pédagogique et est **libre de droits**. Vous êtes autorisé à l'utiliser, le modifier et le partager dans un cadre éducatif.

---

## Auteur
P. PRUVOST – LP Jean Mermoz (Vire Normandie).
