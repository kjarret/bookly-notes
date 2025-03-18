jQuery(document).ready(async function($) {
  // Dictionnaires pour les locations et l'équipe
  let locationDict = {};
  const locationColors = {
    '5':  '#2980B9',   // Esch-sur-alzette
    '6':  '#5DADE2',   // Luxembourg
    '7':  '#2471A3',   // Kirchberg
    '8':  '#F1948A',   // Chatel
    '9':  '#E91E63',   // Arlon
    '10': '#F8BBD0',   // Beauraing
    '11': '#F4D03F',   // Genève CA
    '12': '#F7DC6F',   // Genève EV
    '13': '#27AE60',   // Genève Lausanne
    '14': '#2ECC71',   // Nyon
    '15': '#1E8449'    // Montreux
  };

  let teamDict = {};

  // SVGs
  const plusIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 26 26" fill="#FFF" style="vertical-align: middle;">
      <path d="M13.5,3.188C7.805,3.188,3.188,7.805,3.188,13.5S7.805,23.813,13.5,23.813S23.813,19.195,23.813,13.5 S19.195,3.188,13.5,3.188z M19,15h-4v4h-3v-4H8v-3h4V8h3v4h4V15z"></path>
    </svg>
  `;
  const addNoteIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 256 256" style="margin-top:6px;margin-bottom:6px;">
      <g fill="#000" fill-rule="evenodd" stroke="none">
        <g transform="scale(10.66667,10.66667)">
          <path d="M11,2v9h-9v2h9v9h2v-9h9v-2h-9v-9z"></path>
        </g>
      </g>
    </svg>
  `;
  const subcellSpinner = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      <style>
        .spinner_P7sC { transform-origin: center; animation: spinner_svv2 .75s infinite linear; }
        @keyframes spinner_svv2 { 100% { transform: rotate(360deg); } }
      </style>
      <path d="M10.14,1.16a11,11,0,0,0-9,8.92A1.59,1.59,0,0,0,2.46,12,1.52,1.52,0,0,0,4.11,10.7a8,8,0,0,1,6.66-6.61A1.42,1.42,0,0,0,12,2.69h0A1.57,1.57,0,0,0,10.14,1.16Z" class="spinner_P7sC"/>
    </svg>
  `;

  // --- Fonctions asynchrones pour charger les données ---
  async function fetchAllLocations() {
    try {
      const resp = await $.ajax({
        url: BooklyNotesAjax.ajax_url,
        method: 'GET',
        data: { action: 'bookly_get_locations' },
        dataType: 'json'
      });
      if (resp.success) {
        (resp.data.locations || []).forEach(loc => {
          locationDict[loc.id] = loc.name;
        });
      } else {
        console.error("[Bookly+Notes] fetchAllLocations error:", resp.data);
      }
    } catch (err) {
      console.error("[Bookly+Notes] fetchAllLocations AJAX fail:", err);
    }
  }

  async function fetchAllTeamMembers() {
    try {
      const resp = await $.ajax({
        url: BooklyNotesAjax.ajax_url,
        method: 'GET',
        data: { action: 'bookly_get_team_members' },
        dataType: 'json'
      });
      if (resp.success) {
        let options = `<option value="">(Aucun)</option>`;
        (resp.data.team_members || []).forEach(member => {
          teamDict[member.id] = member.full_name;
          options += `<option value="${member.id}">${member.full_name}</option>`;
        });
        $('#myModalTeamDropdown').html(options);
        window.teamDict = teamDict;
      } else {
        console.error("[Bookly+Notes] fetchAllTeamMembers error:", resp.data);
      }
    } catch (err) {
      console.error("[Bookly+Notes] fetchAllTeamMembers AJAX fail:", err);
    }
  }

  // --- Chargement en batch des notes ---
  async function batchLoadNotes() {
    let combinedIds = [];
    $('.my-subcell').each(function(){
      let cid = $(this).data('combinedid');
      if (cid && !$(this).data('loaded')) {
        combinedIds.push(cid);
      }
    });
    if (combinedIds.length === 0) return;
    combinedIds = [...new Set(combinedIds)];
    try {
      const resp = await $.ajax({
        url: BooklyNotesAjax.ajax_url,
        method: 'GET',
        data: { action: 'bookly_get_notes_batch', day_ids: combinedIds },
        dataType: 'json'
      });
      if (resp.success) {
        const notesData = resp.data.notes;
        $('.my-subcell').each(function(){
          let $cell = $(this);
          let cid = $cell.data('combinedid');
          if (notesData.hasOwnProperty(cid)) {
            const data = notesData[cid];
            const note = data.note || "";
            const locationId = data.location_id || "";
            const teamMemberId = data.team_member_id || "";
            let locName = locationDict[locationId] || "";
            let shortLoc = (locName === "Genève CA") ? "G_CA" :
                           (locName === "Genève EV") ? "G_EV" :
                           (locName ? locName.substring(0,3).toUpperCase() : "");
            let teamName = (teamMemberId && window.teamDict) ? window.teamDict[teamMemberId] || "" : "";
            let hasNote = note.trim().length > 0;
            let content = shortLoc;
            if (hasNote) {
              content += " " + plusIcon;
              $cell.attr('data-tooltip', note);
            } else {
              $cell.removeAttr('data-tooltip');
            }
            if (teamName) {
              content += "<br><span class='staff-label'>" + teamName + "</span>";
            }
            $cell.html(content || addNoteIcon);
            if (locationId) {
              $cell.css("background-color", locationColors[locationId] || "#DDD");
            } else {
              $cell.css("background-color", "");
            }
            $cell.data('loaded', true);
          } else {
            $cell.html(addNoteIcon);
            $cell.data('loaded', true);
          }
        });
      } else {
        console.error("[Bookly+Notes] Batch load error:", resp.data);
      }
    } catch (err) {
      console.error("[Bookly+Notes] Batch AJAX error:", err);
    }
  }

  // --- Création du modal si inexistant ---
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
            <option value="">(Aucun)</option>
          </select>
          <br/><br/>
          <label>Thérapeute : </label>
          <select id="myModalTeamDropdown" style="width:100%;">
            <option value="">(Aucun)</option>
          </select>
          <br/><br/>
          <div class="button-champ">
            <button class="modal-button" id="myModalSaveBtn">Enregistrer</button>
            <button class="modal-button" id="myModalDeleteBtn">Supprimer</button>
          </div>
        </div>
      </div>
    `);
    $('#myModal .my-modal-close').on('click', () => { $('#myModal').hide(); });
    $('#myModal').on('click', function(e){
      if ($(e.target).is('#myModal')) { $('#myModal').hide(); }
    });
  }

  const $modal = $('#myModal'),
        $modalTitle = $('#myModalTitle'),
        $modalTextarea = $('#myModalTextarea'),
        $modalLocDropdown = $('#myModalLocationDropdown'),
        $modalTeamDropdown = $('#myModalTeamDropdown'),
        $modalSaveBtn = $('#myModalSaveBtn'),
        $modalDeleteBtn = $('#myModalDeleteBtn');

  let currentDayId = null,
      currentSubcell = null;

  // --- Observation d'une cellule (sur le <time>) ---
  function observeHeaderCell($dayCell) {
    const timeEl = $dayCell.find('time[datetime], time[aria-label]').get(0);
    if (!timeEl) {
      console.error("[Bookly+Notes] Aucun <time> trouvé dans la cellule", $dayCell);
      return;
    }
    const observer = new MutationObserver(() => {
      $dayCell.removeClass('cells-initialized').find('.my-extra-row').remove();
      addThreeSubcellsTo($dayCell);
      observer.disconnect();
    });
    observer.observe(timeEl, { childList: true, characterData: true, subtree: true });
  }

  // --- Création des sous-cellules dans une cellule d'en‑tête ---
  function addThreeSubcellsTo($dayCell) {
    $dayCell.find('.my-extra-row').remove();
    $dayCell.removeClass('cells-initialized');
    let dayId = "";
    const ariaLabel = $dayCell.find('time[aria-label]').attr('aria-label');
    if (ariaLabel) {
      dayId = moment(ariaLabel, "dddd D MMMM YYYY", "fr").format("YYYY-MM-DD");
    } else {
      dayId = ($dayCell.find('time[datetime]').attr('datetime') || "").trim();
    }
    $dayCell.data('day-id', dayId);
    $dayCell.addClass('cells-initialized');
    $dayCell.append(`
      <div class="my-extra-row" data-base-day="${dayId}" style="display:flex; gap:8px; margin-top:10px;">
        <div class="my-subcell" data-subcell="1" data-combinedid="${dayId}-1">${subcellSpinner}</div>
        <div class="my-subcell" data-subcell="2" data-combinedid="${dayId}-2">${subcellSpinner}</div>
        <div class="my-subcell" data-subcell="3" data-combinedid="${dayId}-3">${subcellSpinner}</div>
      </div>
    `);
    observeHeaderCell($dayCell);
  }

  // --- Ajoute les sous-cellules pour toutes les cellules non initialisées et lance le chargement batch ---
  function addThreeSubcells() {
    $('.ec-day[role="columnheader"]:not(.cells-initialized)').each(function(){
      addThreeSubcellsTo($(this));
    });
    adjustSubcellWidths();
    batchLoadNotes();
  }

  // --- Ajuste la largeur des sous-cellules ---
  function adjustSubcellWidths() {
    let booklyCalTabId = $.cookie('bookly_cal_tab_id');
    if (booklyCalTabId && booklyCalTabId >= 2 && booklyCalTabId <= 4) {
      let mainIndex = booklyCalTabId - 2;
      $(".my-extra-row").each(function(){
        $(this).children().each(function(index){
          if (index === mainIndex) {
            $(this).css("width", "70%");
          } else {
            $(this).css("width", "15%");
          }
        });
      });
    } else {
      $(".my-extra-row").children().css("width", "33.33%");
    }
  }

  // --- Gestion du clic sur une sous-cellule pour ouvrir le modal ---
  $(document).on('click', '.my-subcell', async function(){
    currentDayId = $(this).closest('.my-extra-row').data('base-day');
    currentSubcell = $(this).data('subcell');
    $modalTitle.text("Jour " + currentDayId + " / Sous-cell " + currentSubcell);
    $modalTextarea.val("");
    $modalLocDropdown.empty();
    $modalTeamDropdown.empty();
    $modal.show();
    const combinedId = currentDayId + "-" + currentSubcell;
    try {
      const resp = await $.ajax({
        url: BooklyNotesAjax.ajax_url,
        method: 'GET',
        data: { action: 'bookly_get_note', day_id: combinedId },
        dataType: 'json'
      });
      if (resp.success) {
        $modalTextarea.val(resp.data.note || "");
        const savedLocId = resp.data.location_id || "";
        const savedTeamId = resp.data.team_member_id || "";
        $modalLocDropdown.append(`<option value="">(Aucun)</option>`);
        let locOptions = Object.keys(locationDict).map(id => {
          let color = locationColors[id] || "#000000";
          return `<option value="${id}" data-color="${color}">${locationDict[id]}</option>`;
        });
        $modalLocDropdown.append(locOptions.join(""));
        if (savedLocId) { $modalLocDropdown.val(savedLocId); }
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
        $modalTeamDropdown.append(`<option value="">(Aucun)</option>`);
        await fetchAllTeamMembers();
        if (!savedTeamId) {
          let subcellNum = parseInt(currentSubcell, 10);
          let defaultTeamId = "";
          if (subcellNum === 1) {
            defaultTeamId = "2";
          } else if (subcellNum === 2) {
            defaultTeamId = "3";
          } else if (subcellNum === 3) {
            defaultTeamId = "4";
          }
          $modalTeamDropdown.val(defaultTeamId);
        } else {
          $modalTeamDropdown.val(savedTeamId);
        }
      } else {
        console.error("[Bookly+Notes] GET (modal) error:", resp.data.message);
      }
    } catch (err) {
      console.error("[Bookly+Notes] GET (modal) AJAX error:", err);
    }
  });

  // --- Bouton Enregistrer ---
  $modalSaveBtn.on('click', async function(){
    if (!currentDayId || !currentSubcell) {
      alert("Erreur : dayId / sous-cellule manquant");
      return;
    }
    const content = $modalTextarea.val() || "";
    const location_id = $modalLocDropdown.val() || "";
    const team_member_id = $modalTeamDropdown.val() || "";
    const combinedId = currentDayId + "-" + currentSubcell;
    try {
      const resp = await $.ajax({
        url: BooklyNotesAjax.ajax_url,
        method: 'POST',
        data: {
          action: 'bookly_save_note',
          day_id: combinedId,
          note: content,
          location_id: location_id,
          team_member_id: team_member_id
        },
        dataType: 'json'
      });
      if (resp.success) {
        alert("La note est sauvegardée !");
        $modal.hide();
        const $dayCell = $(`.ec-day[role="columnheader"].cells-initialized:has(time[datetime='${currentDayId}'])`);
        const $subcell = $dayCell.find(`.my-subcell[data-subcell='${currentSubcell}']`);
        let locName = locationDict[location_id] || "";
        let shortLoc = (locName === "Genève CA") ? "G_CA" : ((locName === "Genève EV") ? "G_EV" : (locName ? locName.substring(0, 3).toUpperCase() : ""));
        let teamName = (team_member_id && window.teamDict) ? window.teamDict[team_member_id] || "" : "";
        let hasNote = content.trim().length > 0;
        let newHtml = shortLoc + (hasNote ? " " + plusIcon : "");
        if (teamName) {
          newHtml += "<br><span class='staff-label'>" + teamName + "</span>";
        }
        $subcell.html(newHtml || addNoteIcon);
        if (location_id) {
          $subcell.css("background-color", locationColors[location_id] || "#DDD");
        } else {
          $subcell.css("background-color", "");
        }
        if (hasNote) {
          $subcell.attr('data-tooltip', content);
        } else {
          $subcell.removeAttr('data-tooltip');
        }
        adjustSubcellWidths();
      } else {
        alert("Erreur save_note => " + resp.data.message);
      }
    } catch (err) {
      console.error("[Bookly+Notes] SAVE AJAX error:", err);
    }
  });

  // --- Bouton Supprimer ---
  $modalDeleteBtn.on('click', async function(){
    if (!currentDayId || !currentSubcell) {
      alert("Erreur : dayId / sous-cellule manquant");
      return;
    }
    if (!confirm("Confirmez-vous la suppression de cette note ?")) {
      return;
    }
    const combinedId = currentDayId + "-" + currentSubcell;
    try {
      const resp = await $.ajax({
        url: BooklyNotesAjax.ajax_url,
        method: 'POST',
        data: { action: 'bookly_delete_note', day_id: combinedId },
        dataType: 'json'
      });
      if (resp.success) {
        alert("Note supprimée !");
        $modal.hide();
        const $dayCell = $(`.ec-day[role="columnheader"].cells-initialized:has(time[datetime='${currentDayId}'])`);
        const $subcell = $dayCell.find(`.my-subcell[data-subcell='${currentSubcell}']`);
        $subcell.html(addNoteIcon).css("background-color", "");
        $subcell.removeAttr('data-tooltip');
        adjustSubcellWidths();
      } else {
        alert("Erreur delete_note => " + resp.data.message);
      }
    } catch (err) {
      console.error("[Bookly+Notes] DELETE AJAX error:", err);
    }
  });

  // --- Détection des changements de vue / semaine via divers boutons ---
  $(document).on('click', '.ec-start, #bookly-calendar-refresh, .ec-dayGridMonth, .ec-timeGridWeek, .ec-resourceTimeGridDay, .ec-grid, .ec-listWeek', function(){
    setTimeout(function(){
      $('.ec-day[role="columnheader"]').each(function(){
        $(this).removeClass('cells-initialized').find('.my-extra-row').remove();
      });
      addThreeSubcells();
      adjustSubcellWidths();
    }, 500);
  });

  $(document).on('click', '.table-condensed', function(){
    setTimeout(function(){
      $('.ec-day[role="columnheader"]').each(function(){
        $(this).find('.my-subcell').data('loaded', false);
      });
      batchLoadNotes();
    }, 2000);
  });

  $(document).on('click', '.nav-link', function(){
    setTimeout(function(){
      adjustSubcellWidths();
    }, 500);
  });

  // --- IntersectionObserver pour les cellules non initialisées ---
  function initIntersectionObserver() {
    const observerOptions = { root: null, threshold: 0.1 };
    const intersectionObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          addThreeSubcellsTo($(entry.target));
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);
    $('.ec-day[role="columnheader"]').each(function(){
      if (!$(this).hasClass('cells-initialized')) {
        intersectionObserver.observe(this);
      }
    });
  }

  // --- Hook sur calendar.refetchEvents() pour rafraîchir les sous-cellules lors d'un changement de vue ---
  if (typeof calendar !== 'undefined' && calendar.ec && typeof calendar.ec.refetchEvents === 'function') {
    let originalRefetch = calendar.ec.refetchEvents;
    calendar.ec.refetchEvents = function(){
      originalRefetch.apply(this, arguments);
      setTimeout(function(){
        $('.ec-day[role="columnheader"]').each(function(){
          $(this).removeClass('cells-initialized').find('.my-extra-row').remove();
        });
        addThreeSubcells();
        adjustSubcellWidths();
      }, 500);
    };
  } else {
    $(document).on('bookly_calendar_view_changed', function(){
      $('.ec-day[role="columnheader"]').each(function(){
        $(this).removeClass('cells-initialized').find('.my-extra-row').remove();
      });
      addThreeSubcells();
      adjustSubcellWidths();
    });
  }

  function addThreeSubcells() {
    $('.ec-day[role="columnheader"]:not(.cells-initialized)').each(function(){
      addThreeSubcellsTo($(this));
    });
    adjustSubcellWidths();
    batchLoadNotes();
  }

  // --- Lancement initial ---
  await fetchAllLocations();
  await fetchAllTeamMembers();
  initIntersectionObserver();
  setTimeout(function(){
    $('.ec-day[role="columnheader"]:not(.cells-initialized)').each(function(){
      addThreeSubcellsTo($(this));
    });
    adjustSubcellWidths();
    batchLoadNotes();
  }, 2000);

  // --- Observer sur le titre du calendrier pour détecter les changements de semaine ---
  const titleElement = document.querySelector('.ec-title');
  if (titleElement) {
    const titleObserver = new MutationObserver((mutationsList) => {
      mutationsList.forEach(mutation => {
        if (mutation.type === 'childList' || mutation.type === 'characterData') {
          console.log("[Bookly+Notes] Changement du titre:", titleElement.textContent);
          $('.ec-day[role="columnheader"]').each(function(){
            $(this).removeClass('cells-initialized').find('.my-extra-row').remove();
          });
          addThreeSubcells();
          adjustSubcellWidths();
        }
      });
    });
    titleObserver.observe(titleElement, { childList: true, characterData: true, subtree: true });
  } else {
    console.error("[Bookly+Notes] Élément .ec-title introuvable");
  }
});
