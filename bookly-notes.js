jQuery(document).ready(function($){
  console.log("[Bookly+Notes] Script chargé.");

  // 1) Objet pour associer location_id => nom et location_id => couleur
  let locationDict   = {}; // { "5": "Arlon", ... }
  let locationColors = {
    '5':  '#FF5733',
    '6':  '#33FF57',
    '7':  '#3357FF',
    '8':  '#FF33A1',
    '9':  '#33FFA1',
    '10': '#A133FF',
    '11': '#FF8F33',
    '12': '#33FF8F',
    '13': '#8F33FF',
    '14': '#FF3333',
    '15': '#33FF33'
  };

  // 2) SVG plusIcon pour indiquer qu'une note existe
  const plusIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="14" height="14" viewBox="0 0 26 26" style="vertical-align: middle;">
      <path d="M13.5,3.188C7.805,3.188,3.188,7.805,3.188,13.5S7.805,23.813,13.5,23.813S23.813,19.195,23.813,13.5
      S19.195,3.188,13.5,3.188z M19,15h-4v4h-3v-4H8v-3h4V8h3v4h4V15z"></path>
    </svg>
  `;

  // 3) Charger la liste des locations UNE FOIS pour remplir locationDict
  //    On le fait très tôt pour pouvoir l'utiliser sans rechargement multiple
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
          locationDict[loc.id] = loc.name; // ex: { '5': 'Arlon', ... }
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
    $('#myModal .my-modal-close').on('click', () => $('#myModal').hide());
    $('#myModal').on('click', function(e){
      if ($(e.target).is('#myModal')) {
        $('#myModal').hide();
      }
    });
  }

  const $modal            = $('#myModal');
  const $modalTitle       = $('#myModalTitle');
  const $modalTextarea    = $('#myModalTextarea');
  const $modalLocDropdown = $('#myModalLocationDropdown');
  const $modalSaveBtn     = $('#myModalSaveBtn');
  //const $modalDeleteBtn   = $('#myModalDeleteBtn'); // si vous l'utilisez

  let currentDayId   = null;
  let currentSubcell = null;

  // Code SVG du spinner (pour l'initialisation)
  const subcellSpinner = `
    <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <style>
        .spinner_P7sC {
          transform-origin: center;
          animation: spinner_svv2 .75s infinite linear;
        }
        @keyframes spinner_svv2 {
          100% { transform: rotate(360deg); }
        }
      </style>
      <path d="M10.14,1.16a11,11,0,0,0-9,8.92A1.59,1.59,0,0,0,2.46,12,1.52,1.52,0,0,0,4.11,10.7a8,8,0,0,1,6.66-6.61A1.42,1.42,0,0,0,12,2.69h0A1.57,1.57,0,0,0,10.14,1.16Z" class="spinner_P7sC"/>
    </svg>
  `;

  // Observer : surveille <time> pour détecter un changement
  function observeHeaderCell($dayCell) {
    const timeEl = $dayCell.find('time[datetime], time[aria-label]').get(0);
    if (!timeEl) return;
    const observer = new MutationObserver(function(mutations) {
      $dayCell.removeClass('cells-initialized').find('.my-extra-row').remove();
      addThreeSubcellsTo($dayCell);
      observer.disconnect();
    });
    observer.observe(timeEl, { characterData: true, childList: true, subtree: true });
  }

  // Injection des sous-cellules
  function addThreeSubcellsTo($dayCell) {
    $dayCell.find('.my-extra-row').remove();
    $dayCell.removeClass('cells-initialized');

    let dayId = "";
    const ariaLabel = $dayCell.find('time[aria-label]').attr('aria-label');
    if (ariaLabel) {
      // On parse la date depuis aria-label
      dayId = moment(ariaLabel, "dddd D MMMM YYYY", "fr").format("YYYY-MM-DD");
    } else {
      const raw = $dayCell.find('time[datetime]').attr('datetime') || '';
      dayId = raw.trim();
    }
    $dayCell.addClass('cells-initialized');
    $dayCell.append(`
      <div class="my-extra-row" style="display:flex; gap:8px; margin-top:10px;">
        <div class="my-subcell" data-subcell="1">${subcellSpinner}</div>
        <div class="my-subcell" data-subcell="2">${subcellSpinner}</div>
        <div class="my-subcell" data-subcell="3">${subcellSpinner}</div>
      </div>
    `);

    // GET notes
    for (let sc = 1; sc <= 3; sc++) {
      const $subcell = $dayCell.find(`.my-subcell[data-subcell='${sc}']`);
      const combinedId = dayId + "-" + sc;

      $.ajax({
        url: BooklyNotesAjax.ajax_url,
        method: 'GET',
        data: { action: 'bookly_get_note', day_id: combinedId },
        dataType: 'json',
        success: function(resp){
          if (resp.success) {
            const note       = resp.data.note || "";
            const locationId = resp.data.location_id || "";
            // 3 premières lettres de la location
            let locName   = locationDict[locationId] || "";
            let shortLoc  = locName.substring(0,3).toUpperCase();
            let hasNote   = note.trim().length > 0;
            // Contenu = shortLoc + svg si note
            let content   = shortLoc;
            if (hasNote) {
              content += " " + plusIcon;
            }
            // On remplace le spinner par le content
            $subcell.html(content || "+");

            // Couleur de fond
            if (locationId) {
              let color = locationColors[locationId] || "#DDD";
              $subcell.css("background-color", color);
            } else {
              $subcell.css("background-color", "");
            }
          } else {
            $subcell.text("+");
          }
        },
        error: function(err){
          $subcell.text("+");
        }
      });
    }

    // Observer
    observeHeaderCell($dayCell);

    // Clic => ouvre le modal
    $dayCell.find('.my-subcell').on('click', function(){
      currentDayId   = dayId;
      currentSubcell = $(this).attr('data-subcell');
      $modalTitle.text("Jour " + dayId + " / Sous-cell " + currentSubcell);
      $modalTextarea.val("");
      $modalLocDropdown.empty().append('<option value="">(Aucune)</option>');
      $modal.show();

      const combinedId = dayId + "-" + currentSubcell;
      // GET note + location
      $.ajax({
        url: BooklyNotesAjax.ajax_url,
        method: 'GET',
        data: { action: 'bookly_get_note', day_id: combinedId },
        dataType: 'json',
        success: function(resp) {
          if (resp.success) {
            $modalTextarea.val(resp.data.note || "");
            const savedLocId = resp.data.location_id || "";
            // Charger la liste des locations
            let locOptions = Object.keys(locationDict).map(id => {
              let color = locationColors[id] || "#000000";
              return `<option value="${id}" data-color="${color}">${locationDict[id]}</option>`;
            });
            $modalLocDropdown.append(locOptions.join(""));
            if (savedLocId) {
              $modalLocDropdown.val(savedLocId);
            }
            // Init Select2
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
          // Mettre à jour la sous-cellule
          const $dayCell = $(`.ec-day[role="columnheader"].cells-initialized:has(time[datetime='${currentDayId}'])`);
          const $subcell = $dayCell.find(`.my-subcell[data-subcell='${currentSubcell}']`);
          let locName  = locationDict[location_id] || "";
          let shortLoc = locName.substring(0,3).toUpperCase();
          let hasNote  = content.trim().length > 0;
          let newHtml  = shortLoc + (hasNote ? " " + plusIcon : "");
          $subcell.html(newHtml || "+");
          // Couleur
          if (location_id) {
            let color = locationColors[location_id] || "#DDD";
            $subcell.css("background-color", color);
          } else {
            $subcell.css("background-color", "");
          }
        } else {
          alert("Erreur save_note => " + resp.data.message);
        }
      }
    });
  });

  // Détection changement de semaine
  $('.ec-prev, .ec-next').on('click', function(){
    setTimeout(function(){
      $('.ec-day[role="columnheader"]').each(function(){
        $(this).removeClass('cells-initialized').find('.my-extra-row').remove();
      });
      addThreeSubcells();
    }, 500);
  });

  // IntersectionObserver + fallback
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

  // Hook sur calendar.refetchEvents()
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
