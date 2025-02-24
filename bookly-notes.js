jQuery(document).ready(function($){
  console.log("[Bookly+Notes] Script chargé.");

  // 1) Objet pour associer location_id => nom et location_id => couleur
  let locationDict   = {}; // { "5": "Arlon", ... }
  let locationColors = {
    '5':  '#E74C3C',   // Esch-sur-alzette
    '6':  '#27AE60',   // Luxembourg
    '7':  '#2980B9',   // Kirchberg
    '8':  '#8E44AD',   // Chatel
    '9':  '#F1C40F',   // Arlon
    '10': '#16A085',   // Beauraing
    '11': '#D35400',   // Genève CA
    '12': '#565b61',   // Genève EV
    '13': '#7F8C8D',   // Genève Lausanne
    '14': '#F39C12',   // Nyon
    '15': '#C0392B'    // Montreux
  };
  

  // 2) SVG plusIcon pour indiquer qu'une note existe
  const plusIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="14" height="14" viewBox="0 0 26 26" fill="#FFF" style="vertical-align: middle;">
      <path d="M13.5,3.188C7.805,3.188,3.188,7.805,3.188,13.5S7.805,23.813,13.5,23.813S23.813,19.195,23.813,13.5
      S19.195,3.188,13.5,3.188z M19,15h-4v4h-3v-4H8v-3h4V8h3v4h4V15z"></path>
    </svg>
  `;

  // 3) Charger la liste des locations UNE FOIS pour remplir locationDict
  function fetchAllLocations() {
    return $.ajax({
      url: BooklyNotesAjax.ajax_url,
      method: 'GET',
      data: { action: 'bookly_get_locations' },
      dataType: 'json'
    }).done(function(resp){
      if (resp.success) {
        let locs = resp.data.locations || [];
        console.log("[Bookly+Notes] fetchAllLocations =>", locs);
        locs.forEach(loc => {
          locationDict[loc.id] = loc.name;
        });
      } else {
        console.warn("[Bookly+Notes] fetchAllLocations error =>", resp.data);
      }
    }).fail(function(err){
      console.error("[Bookly+Notes] fetchAllLocations AJAX fail =>", err);
    });
  }

  // 4) Création du modal s'il n'existe pas déjà
  if (!$('#myModal').length) {
    $('body').append(`
      <div id="myModal" class="my-modal">
        <div class="my-modal-content">
          <span class="my-modal-close">&times;</span>
          <h3 id="myModalTitle">Titre</h3>
          <textarea id="myModalTextarea" rows="6" style="width:100%;"></textarea>
          <br/><br/>
          <label>Cabinet : </label>
          <select id="myModalLocationDropdown" style="width:100%;">
            <option value="">(Aucune)</option>
          </select>
          <br/><br/>
          <div class="button-champ">
            <button class="modal-button" id="myModalSaveBtn">Enregistrer</button>
            <button class="modal-button" id="myModalDeleteBtn">Supprimer</button>
          </div>
        </div>
      </div>
    `);
    $('#myModal .my-modal-close').on('click', () => {
      console.log("[Bookly+Notes] Modal fermé (croix)");
      $('#myModal').hide();
    });
    $('#myModal').on('click', function(e){
      if ($(e.target).is('#myModal')) {
        console.log("[Bookly+Notes] Modal fermé (zone grise)");
        $('#myModal').hide();
      }
    });
  } else {
    console.log("[Bookly+Notes] Modal déjà présent.");
  }

  const $modal            = $('#myModal');
  const $modalTitle       = $('#myModalTitle');
  const $modalTextarea    = $('#myModalTextarea');
  const $modalLocDropdown = $('#myModalLocationDropdown');
  const $modalSaveBtn     = $('#myModalSaveBtn');
  const $modalDeleteBtn   = $('#myModalDeleteBtn');


  let currentDayId   = null;
  let currentSubcell = null;

  // Code SVG du spinner
  const subcellSpinner = `
    <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <style>
        .spinner_P7sC { transform-origin: center; animation: spinner_svv2 .75s infinite linear; }
        @keyframes spinner_svv2 { 100% { transform: rotate(360deg); } }
      </style>
      <path d="M10.14,1.16a11,11,0,0,0-9,8.92A1.59,1.59,0,0,0,2.46,12,1.52,1.52,0,0,0,4.11,10.7a8,8,0,0,1,6.66-6.61A1.42,1.42,0,0,0,12,2.69h0A1.57,1.57,0,0,0,10.14,1.16Z" class="spinner_P7sC"/>
    </svg>
  `;

  // Observer : surveille <time> pour détecter les changements
  function observeHeaderCell($dayCell) {
    const timeEl = $dayCell.find('time[datetime], time[aria-label]').get(0);
    if (!timeEl) return;
    const observer = new MutationObserver(function(mutations) {
      $dayCell.removeClass('cells-initialized').find('.my-extra-row').remove();
      addThreeSubcellsTo($dayCell);
      observer.disconnect();
    });
    observer.observe(timeEl, { characterData: true, childList: true, subtree: true });
    console.log("[Bookly+Notes] Observer attaché à", $dayCell);
  }

  // Injection des sous-cellules dans une cellule donnée
  function addThreeSubcellsTo($dayCell) {
    $dayCell.find('.my-extra-row').remove();
    $dayCell.removeClass('cells-initialized');

    let dayId = "";
    const ariaLabel = $dayCell.find('time[aria-label]').attr('aria-label');
    if (ariaLabel) {
      dayId = moment(ariaLabel, "dddd D MMMM YYYY", "fr").format("YYYY-MM-DD");
      console.log("[Bookly+Notes] Récupération via aria-label :", ariaLabel, "->", dayId);
    } else {
      const raw = $dayCell.find('time[datetime]').attr('datetime') || '';
      dayId = raw.trim();
      console.log("[Bookly+Notes] Récupération via datetime :", dayId);
    }
    $dayCell.addClass('cells-initialized');
    $dayCell.append(`
      <div class="my-extra-row" style="display:flex; gap:8px; margin-top:10px;">
        <div class="my-subcell" data-subcell="1">${subcellSpinner}</div>
        <div class="my-subcell" data-subcell="2">${subcellSpinner}</div>
        <div class="my-subcell" data-subcell="3">${subcellSpinner}</div>
      </div>
    `);
    console.log("[Bookly+Notes] Sous-cellules injectées pour dayId =", dayId);

    for (let sc = 1; sc <= 3; sc++) {
      const $subcell = $dayCell.find(`.my-subcell[data-subcell='${sc}']`);
      const combinedId = dayId + "-" + sc;
      console.log("[Bookly+Notes] GET note => combinedId =", combinedId);

      $.ajax({
        url: BooklyNotesAjax.ajax_url,
        method: 'GET',
        data: { action: 'bookly_get_note', day_id: combinedId },
        dataType: 'json',
        success: function(resp){
          if (resp.success) {
            const note       = resp.data.note || "";
            const locationId = resp.data.location_id || "";
            let locName   = locationDict[locationId] || "";
            let shortLoc  = locName.substring(0,3).toUpperCase();
            let hasNote   = note.trim().length > 0;
            let content   = shortLoc;
            if (hasNote) {
              content += " " + plusIcon;
            }
            $subcell.html(content || `<span style="color:#000">+</span>`);
            if (locationId) {
              let color = locationColors[locationId] || "#DDD";
              $subcell.css("background-color", color);
            } else {
              $subcell.css("background-color", "");
            }
            console.log(`[Bookly+Notes] GET OK: combinedId = '${combinedId}', note = '${note}', location_id = ${resp.data.location_id}`);
          } else {
            console.warn("[Bookly+Notes] GET ERROR: combinedId =", combinedId, resp.data.message);
            $subcell.text("+");
          }
        },
        error: function(err){
          console.error("[Bookly+Notes] GET AJAX error for combinedId =", combinedId, err);
          $subcell.text("+");
        }
      });
    }

    observeHeaderCell($dayCell);

    $dayCell.find('.my-subcell').on('click', function(){
      currentDayId   = dayId;
      currentSubcell = $(this).attr('data-subcell');
      console.log("[Bookly+Notes] Clic sur sous-cellule => dayId =", dayId, ", subcell =", currentSubcell);
      $modalTitle.text("Jour " + dayId + " / Sous-cell " + currentSubcell);
      $modalTextarea.val("");
      $modalLocDropdown.empty().append('<option value="">(Aucune)</option>');
      $modal.show();
      console.log("[Bookly+Notes] Modal affiché pour dayId =", dayId, ", subcell =", currentSubcell);

      const combinedId = dayId + "-" + currentSubcell;
      console.log("[Bookly+Notes] Rechargement de la note pour combinedId =", combinedId);
      $.ajax({
        url: BooklyNotesAjax.ajax_url,
        method: 'GET',
        data: { action: 'bookly_get_note', day_id: combinedId },
        dataType: 'json',
        success: function(resp) {
          if (resp.success) {
            $modalTextarea.val(resp.data.note || "");
            const savedLocId = resp.data.location_id || "";
            console.log(`[Bookly+Notes] GET (modal) OK: combinedId = '${combinedId}', note = '${resp.data.note}', loc = ${savedLocId}`);
            let locOptions = Object.keys(locationDict).map(id => {
              let color = locationColors[id] || "#000000";
              return `<option value="${id}" data-color="${color}">${locationDict[id]}</option>`;
            });
            $modalLocDropdown.append(locOptions.join(""));
            if (savedLocId) {
              $modalLocDropdown.val(savedLocId);
              console.log("[Bookly+Notes] Location pré-sélectionnée :", savedLocId);
            }
            $modalLocDropdown.select2({
              width: 'resolve',
              dropdownParent: $modal,
              templateResult: function(option) {
                if (!option.id) return option.text;
                let col = $(option.element).data('color') || '#000000';
                return $(`
                  <span>
                    <svg width="12" height="12" style="vertical-align: middle; margin-right: 4px;">
                      <circle cx="6" cy="6" r="5" fill="${col}" />
                    </svg>
                    ${option.text}
                  </span>
                `);
              },
              templateSelection: function(option) {
                if (!option.id) return option.text;
                let col = $(option.element).data('color') || '#000000';
                return $(`
                  <span>
                    <svg width="12" height="12" style="vertical-align: middle; margin-right: 4px;">
                      <circle cx="6" cy="6" r="5" fill="${col}" />
                    </svg>
                    ${option.text}
                  </span>
                `);
              },
              escapeMarkup: function(markup) { return markup; }
            });
          }
        }
      });
    });
  }

  // Bouton Enregistrer
  $modalSaveBtn.on('click', function(){
    if (!currentDayId || !currentSubcell) {
      alert("Erreur : dayId / sous-cellule manquant");
      return;
    }
    const content     = $modalTextarea.val() || "";
    const location_id = $modalLocDropdown.val() || "";
    const combinedId  = currentDayId + "-" + currentSubcell;
    console.log(`[Bookly+Notes] SAVE -> combinedId='[${combinedId}]', note='[${content}]', loc=[${location_id}]`);

    $.ajax({
      url: BooklyNotesAjax.ajax_url,
      method: 'POST',
      data: {
        action: 'bookly_save_note',
        day_id: combinedId,
        note: content,
        location_id: location_id
      },
      dataType: 'json',
      success: function(resp){
        if (resp.success) {
          alert("Note/Location sauvegardés !");
          $modal.hide();
          const $dayCell = $(`.ec-day[role="columnheader"].cells-initialized:has(time[datetime='${currentDayId}'])`);
          const $subcell = $dayCell.find(`.my-subcell[data-subcell='${currentSubcell}']`);
          let locName  = locationDict[location_id] || "";
          let shortLoc = locName.substring(0,3).toUpperCase();
          let hasNote  = content.trim().length > 0;
          let newHtml  = shortLoc + (hasNote ? " " + plusIcon : "");
          $subcell.html(newHtml || "+");
          if (location_id) {
            let color = locationColors[location_id] || "#DDD";
            $subcell.css("background-color", color);
          } else {
            $subcell.css("background-color", "");
          }
          console.log("[Bookly+Notes] Sous-cellule mise à jour avec le contenu :", content);
        } else {
          alert("Erreur save_note => " + resp.data.message);
        }
      },
      error: function(err){
        console.error("[Bookly+Notes] SAVE AJAX error:", err);
      }
    });
  });

  // Bouton Supprimer
  $modalDeleteBtn.on('click', function(){
    if (!currentDayId || !currentSubcell) {
      alert("Erreur : dayId / sous-cellule manquant");
      return;
    }
    if (!confirm("Confirmez-vous la suppression de cette note ?")) {
      return;
    }
    const combinedId = currentDayId + "-" + currentSubcell;
    console.log(`[Bookly+Notes] DELETE -> combinedId='[${combinedId}]'`);

    $.ajax({
      url: BooklyNotesAjax.ajax_url,
      method: 'POST',
      data: { action: 'bookly_delete_note', day_id: combinedId },
      dataType: 'json',
      success: function(resp){
        if (resp.success) {
          alert("Note supprimée !");
          $modal.hide();
          const $dayCell = $(`.ec-day[role="columnheader"].cells-initialized:has(time[datetime='${currentDayId}'])`);
          const $subcell = $dayCell.find(`.my-subcell[data-subcell='${currentSubcell}']`);

          $subcell.html("+");

          $subcell.css("background-color", "");
          console.log("[Bookly+Notes] Sous-cellule réinitialisée après suppression.");
        } else {
          alert("Erreur delete_note => " + resp.data.message);
        }
      },
      error: function(err){
        console.error("[Bookly+Notes] DELETE AJAX error:", err);
      }
    });
  });

  // Détection du changement de semaine
  $('.ec-prev, .ec-next').on('click', function(){
    setTimeout(function(){
      $('.ec-day[role="columnheader"]').each(function(){
        $(this).removeClass('cells-initialized').find('.my-extra-row').remove();
      });
      addThreeSubcells();
    }, 500);
  });

  // Initialisation via IntersectionObserver et fallback
  function initIntersectionObserver() {
    const observerOptions = { root: null, threshold: 0.1 };
    const intersectionObserver = new IntersectionObserver(function(entries, observer) {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const $cell = $(entry.target);
          addThreeSubcellsTo($cell);
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);

    $('.ec-day[role="columnheader"]').each(function() {
      if (!$(this).hasClass('cells-initialized')) {
        intersectionObserver.observe(this);
      }
    });
  }

  // Hook sur calendar.refetchEvents() pour rafraîchir les notes lors d'un changement de semaine
  if (typeof calendar !== 'undefined' && calendar.ec && typeof calendar.ec.refetchEvents === 'function') {
    let originalRefetch = calendar.ec.refetchEvents;
    calendar.ec.refetchEvents = function() {
      originalRefetch.apply(this, arguments);
      setTimeout(function(){
        $('.ec-day[role="columnheader"]').each(function(){
          $(this).removeClass('cells-initialized').find('.my-extra-row').remove();
        });
        addThreeSubcells();
      }, 500);
    };
  }

  // Lancement initial
  fetchAllLocations().done(function(){
    console.log("[Bookly+Notes] All locations fetched =>", locationDict);
    initIntersectionObserver();
    setTimeout(function(){
      let $notInit = $('.ec-day[role="columnheader"]:not(.cells-initialized)');
      if ($notInit.length > 0) {
        $notInit.each(function(){ addThreeSubcellsTo($(this)); });
      }
    }, 2000);
  });
});
