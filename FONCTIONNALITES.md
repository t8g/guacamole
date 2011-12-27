
Présentation
============

Guacamole est une application de gestion électronique de documents (GED) en ligne.

Modèles
=======

Document :

* identifiant unique
* url unique ('./documents/[slug]')
* titre
* description,
* ressource (nom du fichier, URL du fichier)
* tags,
* vignette,
* dernier contributeur (relation)
* date de dernière modification

Tag :

* label

Contributeur :

* nom
* prénom
* email
* mot de passe

Version 1.0
============

Eléments communs à tous les scénarios de navigation
---------------------------------------------------

Toutes les listes sont paginées et triées par défaut sur la date de modification en ordre antéchronologique.

Tous les boutons de retour renvoient au contexte immédiatement précédent : tri précédent, pagination précédente.

* Filtres : critières de recherche et de tri.
* Tri : Pour chaque recherche, on peut avoir plusieurs critères mais un seul tri possible à la fois. Possibilité d'inverser le tri courant.
* Limites d'affichage : la pagination des listes est systématique partout (1->20 - 21->40, 41->60, etc.)
* A chaque fois que l'on doit saisir un tag dans un formulaire, l'autcomplétion sur tous les tags existants est proposée.
* A chaque fois que l'on présente une liste de document, on présente toujours les mêmes fonctionnalités : tri, sélection, actions supplémentaires


Vue "Accueil"
-------------

Affichage de tous les documents en tableau, filtrable par tag uniquement, paginé par défaut

Pour chaque item de la liste :

* clic sur un document => affichage de la vue "détail d'un document"
* 1 bouton : possibilité d'ajouter un document au panier (sélection courante de l'utilisateur identifié)
* 1 checkbox : possibilité de sélectionner plusieurs documents et de les tagger

Affichage de tous les tags triés par ordre alphabétique

* clic sur un tag => mise en évidence du tag dans une liste des tags courant, filtrage de la liste des documents
* on peut cliquer sur plusieurs tags pour combiner plusieurs filtres
* on peut retirer un tag de la liste des critères pour réduire/augmenter le filtrage courant

Vue "Panier"
------------

Sélection de document, réalisée manuellement par l'utilisateur au fil de sa visite

Sur le panier, plusieurs actions possibles sur les documents sélectionnés :

* supprimer en masse
* ajouter un tag : champ de texte libre
* retirer un tag : proposé en liste déroulante, liste limitée aux tags trouvés dans les documents sélectionnés

Vue "Recherche avancée"
-----------------------

Affichage des différents critères de recherche sous forme de formulaire :

* par titre, par description,
* par tags, liste des tags séparés par une virgule
* par date de modification (datepicker)
* par nom de fichier

Vue "Détail d'un document"
--------------------------

* présentation de toutes les informations disponibles
* affichage d'une vignette à chaque fois que cela est possible (extraction de couverture d'un pdf)
* 3 boutons d'action : éditer / modifier / retour à la liste (retour dans le contexte précédent)

Vue "Edition d'un document"
---------------------------

Formulaire permettant de modifier les champs d'un document :

* titre
* description
* tags
* upload d'une nouvelle version du document
* upload d'une vignette (prend le pas sur la génération automatique)

Vue "Edition d'un tag"
----------------------

* Suppression d'un tag, proposé uniquenemt si plus aucun document ne lui est rattaché


Roadmap
=======

version 1.1
-----------

* Import/export d'une archive de documents (.zip)
* Recherche par contributeur (le dernier contributeur uniquement, pas de gestion d'historique)
* Vue "Recherche avancée" : + 1 critère "recherche par extension de fichier"
* Vue "Tags sans documents attachés" et bouton de suppression de ces tags sans docuemnts attachés
* Profil administrateur / contributeur / lecture seule
* oAuth ?


