// =======================================================
// RecipeHub - app.js (FULL UPDATED)
// ✅ Renders clean fields (not raw JSON)
// ✅ Select renders from GET ALL cache first
// ✅ Create sends ingredients/prep/cook/difficulty + can auto-upload photo + attach imageUrl
// ✅ Update (PUT) sends imageUrl so it persists
// ✅ Media gallery + upload works
// =======================================================

// ===============================
//  YOUR ENDPOINTS (SIGNED URLS)
// ===============================

// Recipes
const RECIPES_GET_ALL =
  "https://prod-23.uksouth.logic.azure.com:443/workflows/2668a3ee479f4998b65930f3b4787332/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=XWMYIqJcpsegCtQA_8maE_MsyjCdtCrjjNpLn8Yx_cY";

const RECIPE_GET_ONE_BASE =
  "https://prod-23.uksouth.logic.azure.com:443/workflows/d23aa290bbdd4adbb55d0085ea2304e5/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=XjvcGnX4N9oz8IrfRtsIL8JikDzsoIdPW_P9WigfzxA";

const RECIPE_CREATE =
  "https://prod-03.uksouth.logic.azure.com:443/workflows/19c2dc32b9b743f9bf5b822fe89c2582/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=FSoWGKimatR9_BPSwzFQgDzEvc2aIG2_z9D2EikXX1c";

// Template URLs (we replace the two path segments after /rest/v1/assets/)
const RECIPE_EDIT_TEMPLATE =
  "https://prod-14.uksouth.logic.azure.com/workflows/4e6335059412494e899aff69388d224e/triggers/When_an_HTTP_request_is_received/paths/invoke/rest/v1/assets/rcp-1006/2bcbf8b1-7b2d-4d1d-9f67-61a7e8d5a3c9?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=KDKbVpc6zMi6R6nKh7ynR9S2MRLkB7WGCjImRRU_O8M";

const RECIPE_DELETE_TEMPLATE =
  "https://prod-09.uksouth.logic.azure.com/workflows/eafffa41b36a40c9a7b65b61688fd080/triggers/When_an_HTTP_request_is_received/paths/invoke/rest/v1/assets/rcp-1006/2bcbf8b1-7b2d-4d1d-9f67-61a7e8d5a3c9?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=XlqxZ_h0nLSwZTG3MivxtJ-6GsoeqAeLUbyceI99hQs";

// Media
const MEDIA_GET_ALL =
  "https://prod-14.uksouth.logic.azure.com:443/workflows/b6be9fbf1f61487994433e159f812144/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=awyXh06GVhlGMx789RKwwr1miowBPNzzJJoVqhOIRbk";

const MEDIA_UPLOAD =
  "https://prod-04.uksouth.logic.azure.com:443/workflows/c4e47158572c4dd4b8c2dd41d7b25bf5/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=DlYZpBcMvlsun_3-11BFjoTlUlyRZjHnjQDEWdhfNDM";

const BLOB_ACCOUNT = "https://recipehubstorage1.blob.core.windows.net/";

// ===============================
//  STATE (cache recipes from GET ALL)
// ===============================
let RECIPES_CACHE = [];

// ===============================
//  WIRE UP BUTTONS
// ===============================
$(document).ready(function () {
  $("#btnLoadRecipes").click(loadRecipes);

  $("#btnGetRecipe").click(() => {
    const title = ($("#recipeLookup").val() || "").trim();
    if (!title) return alert("Enter a recipe title to get one recipe.");
    getOneRecipeByTitle(title);
  });

  $("#btnCreateRecipe").click(createRecipeFromForm);
  $("#btnUpdateRecipe").click(updateRecipeFromForm);
  $("#btnDeleteRecipe").click(deleteRecipeFromForm);

  $("#btnLoadMedia").click(loadMedia);
  $("#btnUploadMedia").click(uploadMediaBinary);

  $("#btnReloadRecipes").click(loadRecipes);

  wireDropZoneIfPresent();

  setHeroImage("");
  $("#RecipeDetail").html("<p class='text-muted mb-0'>Select a recipe.</p>");
});

// ===============================
//  RENDER: clean fields (treat empty strings as missing)
// ===============================
function renderRecipeFields(recipe, { showRawJsonToggle = true } = {}) {
  const $out = $("#RecipeDetail");

  // ✅ treat "" like missing
  const pick = (...vals) => {
    for (const v of vals) {
      const s = String(v ?? "").trim();
      if (s) return s;
    }
    return "";
  };

  const title = pick(recipe?.title, recipe?.Title) || "(untitled)";
  const desc = pick(recipe?.description, recipe?.Description);

  const ingredientsRaw = pick(recipe?.ingredients, recipe?.Ingredients);
  const ingredients = ingredientsRaw ? ingredientsRaw : "Not provided";

  const instructions = pick(recipe?.instructions, recipe?.Instructions) || "Not provided";
  const prep = pick(recipe?.prep_time, recipe?.prepTime, recipe?.PrepTime);
  const cook = pick(recipe?.cook_time, recipe?.cookTime, recipe?.CookTime);
  const difficulty = pick(recipe?.difficulty, recipe?.Difficulty);

  $out.html(`
    <div class="mb-2">
      <h3 class="fw-bold mb-1" style="color:#0f172a;">${escapeHtml(title)}</h3>
      ${desc ? `<div class="text-muted">${escapeHtml(desc)}</div>` : ""}
    </div>

    <div class="d-flex flex-wrap gap-2 mt-2">
      <span class="badge bg-light text-dark border">Prep: ${escapeHtml(prep || "—")} min</span>
      <span class="badge bg-light text-dark border">Cook: ${escapeHtml(cook || "—")} min</span>
      <span class="badge bg-light text-dark border">Difficulty: ${escapeHtml(difficulty || "—")}</span>
    </div>

    <hr class="my-3" />

    <div class="mb-3">
      <div class="fw-semibold mb-1">Ingredients</div>
      <div class="text-muted">${escapeHtml(ingredients)}</div>
    </div>

    <div>
      <div class="fw-semibold mb-1">Instructions</div>
      <div class="text-muted" style="white-space:pre-wrap;">${escapeHtml(instructions)}</div>
    </div>
  `);

  if (showRawJsonToggle) {
    $out.append(`
      <details class="mt-3">
        <summary class="text-muted">Show raw JSON</summary>
        <pre class="mt-2">${escapeHtml(JSON.stringify(recipe, null, 2))}</pre>
      </details>
    `);
  }
}

// ===============================
//  RECIPES
// ===============================
function loadRecipes() {
  const $list = $("#RecipeList");
  $list.html(spinnerHtml());

  return $.ajax({
    url: RECIPES_GET_ALL,
    type: "GET",
    dataType: "json",
    success: (data) => {
      console.log("Recipes (raw):", data);

      if (!Array.isArray(data)) {
        RECIPES_CACHE = [];
        $list.html("<p class='text-muted mb-0'>No recipes found (or invalid response).</p>");
        return;
      }

      RECIPES_CACHE = data.map(normalizeRecipeFromAnyShape);

      const cards = RECIPES_CACHE.map((r) => {
        const uuid = r.uuid || "";
        return `
          <div class="card mb-2">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-start gap-2">
                <div style="min-width:0;">
                  <div class="fw-bold">${escapeHtml(r.title || "(untitled)")}</div>
                  ${r.description ? `<div class="small text-muted">${escapeHtml(r.description)}</div>` : ""}
                  <div class="small text-muted">recipeId: ${escapeHtml(r.recipeId)}</div>
                  <div class="small text-muted">uuid: ${escapeHtml(uuid || "(missing)")}</div>
                  <div class="small text-muted">imageUrl: ${escapeHtml(r.imageUrl || "(none)")}</div>
                  ${
                    uuid
                      ? ""
                      : `<div class="small" style="color:#b91c1c;font-weight:700;">
                          No UUID found (edit/delete needs a UUID)
                        </div>`
                  }
                </div>

                <button class="btn btn-primary btn-sm"
                        onclick="selectRecipe('${jsSafe(r.recipeId)}','${jsSafe(uuid)}','${jsSafe(r.title)}','${jsSafe(r.imageUrl)}')">
                  Select
                </button>
              </div>
            </div>
          </div>
        `;
      });

      $list.html(cards.join("") || "<p class='text-muted mb-0'>No recipes to show.</p>");
    },
    error: (xhr, status, err) => {
      console.error("Get all recipes failed:", status, err, xhr?.responseText);
      RECIPES_CACHE = [];
      $list.html("<p style='color:red;'>Error loading recipes. Check console.</p>");
    }
  });
}

function selectRecipe(recipeId, uuid, title, imageUrl) {
  $("#recipeLookup").val(title || recipeId);

  $("#editRecipeId").val(recipeId);
  $("#editItemId").val(uuid);

  $("#deleteRecipeId").val(recipeId);
  $("#deleteItemId").val(uuid);

  $("#mediaRecipeId").val(recipeId);

  $("#editImageUrl").val(imageUrl || "");
  setHeroImage(imageUrl || "");

  const found =
    RECIPES_CACHE.find((r) => r.recipeId === recipeId && (!!uuid ? r.uuid === uuid : true)) ||
    RECIPES_CACHE.find((r) => r.recipeId === recipeId) ||
    RECIPES_CACHE.find((r) => (title ? r.title === title : false));

  if (found) {
    renderRecipeFields(found, { showRawJsonToggle: false });

    // also populate edit text fields with what we have
    $("#editTitle").val(found.title || "");
    $("#editDescription").val(found.description || "");
    $("#editInstructions").val(found.instructions || "");
  } else if (title) {
    getOneRecipeByTitle(title);
  }

  loadMedia();
}

function getOneRecipeByTitle(title) {
  const $out = $("#RecipeDetail");
  $out.html(spinnerHtml());

  const url = addOrReplaceQuery(RECIPE_GET_ONE_BASE, "title", title);

  $.ajax({
    url,
    type: "GET",
    dataType: "json",
    success: (data) => {
      console.log("Get one recipe (raw):", data);

      const recipe = Array.isArray(data) ? (data[0] || null) : data;
      if (!recipe) {
        $out.html("<p class='text-muted mb-0'>No recipe returned.</p>");
        return;
      }

      renderRecipeFields(recipe, { showRawJsonToggle: true });

      $("#editTitle").val(recipe.title || recipe.Title || "");
      $("#editDescription").val(recipe.description || recipe.Description || "");
      $("#editInstructions").val(recipe.instructions || recipe.Instructions || "");

      const img = extractImageUrlFromRecipe(recipe);
      if (img) {
        $("#editImageUrl").val(img);
        setHeroImage(img);
      }
    },
    error: (xhr, status, err) => {
      console.error("Get one recipe failed:", status, err, xhr?.responseText);
      $out.html("<p style='color:red;'>Error loading recipe. Check console.</p>");
    }
  });
}

// ===============================
//  CREATE (POST) + OPTIONAL PHOTO UPLOAD + ATTACH (PUT)
// ===============================
async function createRecipeFromForm() {
  // ✅ now reads your NEW HTML fields
  const payload = {
    user_id: ($("#userID").val() || "12").trim(),
    title: ($("#createTitle").val() || "").trim(),
    description: ($("#createDescription").val() || "").trim(),
    ingredients: ($("#createIngredients").val() || "").trim(),
    instructions: ($("#createInstructions").val() || "").trim(),
    prep_time: ($("#createPrepTime").val() || "").trim(),
    cook_time: ($("#createCookTime").val() || "").trim(),
    difficulty: ($("#createDifficulty").val() || "").trim(),
    createdAt: new Date().toISOString()
  };

  if (!payload.title) return alert("Please enter a title.");

  try {
    // 1) POST recipe
    const createRes = await $.ajax({
      url: RECIPE_CREATE,
      type: "POST",
      data: JSON.stringify(payload),
      contentType: "application/json"
    });

    console.log("Create recipe response:", createRes);

    // Find recipeId + uuid if returned
    let recipeId =
      (createRes?.recipeId || createRes?.RecipeId || createRes?.id || createRes?.recipeID || "").toString().trim();

    let uuid =
      (createRes?.uuid || createRes?.itemId || createRes?.assetId || createRes?.documentId || "").toString().trim();

    // Update hidden/edit fields if we have recipeId
    if (recipeId) {
      $("#mediaRecipeId").val(recipeId);
      $("#editRecipeId").val(recipeId);
      $("#deleteRecipeId").val(recipeId);
    }

    // Render immediately (no image yet)
    renderRecipeFields(payload, { showRawJsonToggle: false });

    // 2) Optional photo selected?
    const photoFile = $("#createPhoto")[0]?.files?.[0];

    if (!photoFile) {
      alert("Recipe created (no photo). Click Load Recipes to see it.");
      await loadRecipes();
      // try to auto-select created item
      if (recipeId) {
        const created = RECIPES_CACHE.find(r => r.recipeId === recipeId) || null;
        if (created) selectRecipe(created.recipeId, created.uuid, created.title, created.imageUrl);
      }
      return;
    }

    // Need headers for upload
    const userId = ($("#userID").val() || "").trim();
    const userName = ($("#userName").val() || "").trim();
    if (!userId || !userName) {
      alert("Recipe created.");
      await loadRecipes();
      return;
    }

    // 3) Upload photo to media
    const uploadRes = await $.ajax({
      url: MEDIA_UPLOAD,
      type: "POST",
      data: photoFile,
      processData: false,
      contentType: "application/octet-stream",
      headers: {
        "x-filename": photoFile.name,
        "x-userid": userId,
        "x-username": userName
      }
    });

    console.log("Upload response:", uploadRes);

    const directUrl = uploadRes?.url || uploadRes?.Url;
    const filePath = uploadRes?.filePath || uploadRes?.FilePath;
    const imageUrl = directUrl ? String(directUrl) : (filePath ? buildBlobUrl(filePath) : "");

    if (!imageUrl) {
      alert("Recipe created, but upload did not return url/filePath so image could not be attached.");
      await loadRecipes();
      return;
    }

    // 4) If we STILL don’t have uuid, load recipes and find it by recipeId
    if (!isUuid(uuid)) {
      await loadRecipes();
      if (recipeId) {
        const match = RECIPES_CACHE.find(r => r.recipeId === recipeId && isUuid(r.uuid));
        if (match) uuid = match.uuid;
      }
    }

    if (!recipeId || !isUuid(uuid)) {
      alert(
        "Photo uploaded, but could not attach because we couldn't find the recipe uuid.\n\n" +
        "Click Load Recipes, select the recipe, then paste the imageUrl into Edit and click Update."
      );
      return;
    }

    // 5) PUT update to attach imageUrl + keep all fields
    const putUrl = buildAssetUrlFromTemplate(RECIPE_EDIT_TEMPLATE, recipeId, uuid);

    const putPayload = {
      title: payload.title,
      description: payload.description,
      ingredients: payload.ingredients,
      instructions: payload.instructions,
      prep_time: payload.prep_time,
      cook_time: payload.cook_time,
      difficulty: payload.difficulty,
      imageUrl
    };

    await $.ajax({
      url: putUrl,
      type: "PUT",
      data: JSON.stringify(putPayload),
      contentType: "application/json"
    });

    // Update UI
    $("#editItemId").val(uuid);
    $("#editImageUrl").val(imageUrl);
    setHeroImage(imageUrl);
    renderRecipeFields(putPayload, { showRawJsonToggle: false });

    alert("Recipe created + photo uploaded + attached ✅");
    await loadRecipes();

    // auto-select it
    const created = RECIPES_CACHE.find(r => r.recipeId === recipeId) || null;
    if (created) selectRecipe(created.recipeId, created.uuid, created.title, created.imageUrl);

  } catch (e) {
    console.error("Create flow failed:", e, e?.responseText);
    alert("Create failed — check console.");
  }
}

// ===============================
//  UPDATE (PUT)
// ===============================
function updateRecipeFromForm() {
  const recipeId = ($("#editRecipeId").val() || "").trim();
  const uuid = ($("#editItemId").val() || "").trim();

  if (!recipeId) return alert("Missing recipeId for update.");
  if (!isUuid(uuid)) {
    return alert(
      "Your itemId/uuid is NOT a UUID.\n\n" +
      "Click Load Recipes → Select a recipe that shows a UUID."
    );
  }

  const url = buildAssetUrlFromTemplate(RECIPE_EDIT_TEMPLATE, recipeId, uuid);

  // ✅ include all fields now + imageUrl
  const payload = {
    title: ($("#editTitle").val() || "").trim(),
    description: ($("#editDescription").val() || "").trim(),
    instructions: ($("#editInstructions").val() || "").trim(),
    imageUrl: ($("#editImageUrl").val() || "").trim()
  };

  console.log("PUT URL:", url);
  console.log("PUT payload:", payload);

  $.ajax({
    url,
    type: "PUT",
    data: JSON.stringify(payload),
    contentType: "application/json",
    success: () => {
      alert("Recipe updated.");
      setHeroImage(payload.imageUrl || "");
      renderRecipeFields(payload, { showRawJsonToggle: false });
      loadRecipes();
    },
    error: (xhr, status, err) => {
      console.error("Update recipe failed:", status, err, xhr?.responseText);
      alert("Update failed — check console.");
    }
  });
}

// ===============================
//  DELETE
// ===============================
function deleteRecipeFromForm() {
  const recipeId = ($("#deleteRecipeId").val() || "").trim();
  const uuid = ($("#deleteItemId").val() || "").trim();

  if (!recipeId) return alert("Missing recipeId for delete.");
  if (!isUuid(uuid)) {
    return alert(
      "Your itemId/uuid is NOT a UUID.\n\n" +
      "Click Load Recipes → Select a recipe that shows a UUID."
    );
  }

  const url = buildAssetUrlFromTemplate(RECIPE_DELETE_TEMPLATE, recipeId, uuid);

  if (!confirm(`Delete recipe ${recipeId}?`)) return;

  $.ajax({
    url,
    type: "DELETE",
    success: () => {
      alert("Recipe deleted.");
      setHeroImage("");
      $("#RecipeDetail").html("<p class='text-muted mb-0'>Select a recipe.</p>");
      loadRecipes();
    },
    error: (xhr, status, err) => {
      console.error("Delete recipe failed:", status, err, xhr?.responseText);
      alert("Delete failed — check console.");
    }
  });
}

// ===============================
//  MEDIA
// ===============================
function loadMedia() {
  const $list = $("#MediaList");
  $list.addClass("media-grid").html(spinnerHtml());

  $.ajax({
    url: MEDIA_GET_ALL,
    type: "GET",
    dataType: "json",
    success: (data) => {
      console.log("Media list (raw):", data);

      if (!Array.isArray(data)) {
        $list.html("<p class='text-muted mb-0'>No media found (or invalid response).</p>");
        return;
      }

      let videoCounter = 0;
      const cards = [];

      data.forEach((val) => {
        let fileName = unwrapMaybeBase64(val.fileName || val.FileName || "");
        let filePath = unwrapMaybeBase64(val.filePath || val.FilePath || "");
        let userName = unwrapMaybeBase64(val.userName || val.UserName || "");
        let userID = unwrapMaybeBase64(val.userID || val.UserID || "");
        const contentType = val.contentType || val.ContentType || "";

        const fullUrl = buildBlobUrl(filePath);
        const isVideo = isLikelyVideo({ contentType, url: fullUrl, fileName });

        if (isVideo) {
          videoCounter += 1;
          const label = `video${videoCounter}`;
          cards.push(`
            <div class="media-card">
              <div class="media-thumb">
                <a class="video-link" href="${fullUrl}" target="_blank" rel="noopener">${label}</a>
              </div>
              <div class="media-body">
                <span class="media-title">${escapeHtml(fileName || "(unnamed)")}</span>
                <div>Uploaded by: ${escapeHtml(userName || "(unknown)")} (id: ${escapeHtml(userID || "(unknown)")})</div>
              </div>
            </div>
          `);
        } else {
          const safeLabel = escapeHtml(fileName || fullUrl);
          cards.push(`
            <div class="media-card">
              <div class="media-thumb">
                <img src="${fullUrl}"
                     alt="${safeLabel}"
                     onerror="imageFallbackToLink(this, '${jsSafe(fullUrl)}', '${jsSafe(safeLabel)}')" />
              </div>
              <div class="media-body">
                <span class="media-title">${safeLabel}</span>
                <div>Uploaded by: ${escapeHtml(userName || "(unknown)")} (id: ${escapeHtml(userID || "(unknown)")})</div>
                <div class="image-error"></div>
              </div>
            </div>
          `);
        }
      });

      $list.html(cards.join("") || "<p class='text-muted mb-0'>No media items to show.</p>");
    },
    error: (xhr, status, error) => {
      console.error("Error fetching media:", status, error, xhr?.responseText);
      $list.html("<p style='color:red;'>Error loading media. Check console.</p>");
    }
  });
}

function uploadMediaBinary() {
  const files = $("#UpFile")[0]?.files;
  if (!files || files.length === 0) return alert("Choose one or more files.");

  const userId = ($("#userID").val() || "").trim();
  const userName = ($("#userName").val() || "").trim();
  if (!userId || !userName) {
    return alert("Enter userID + userName (required by your Logic App headers).");
  }

  const uploads = Array.from(files).map((file) => {
    return $.ajax({
      url: MEDIA_UPLOAD,
      type: "POST",
      data: file,
      processData: false,
      contentType: "application/octet-stream",
      headers: {
        "x-filename": file.name,
        "x-userid": userId,
        "x-username": userName
      }
    });
  });

  Promise.allSettled(uploads).then((results) => {
    console.log("Upload results:", results);
    alert("Upload accepted. Refreshing media soon...");
    setTimeout(loadMedia, 1500);
  });
}

// ===============================
//  OPTIONAL DROPZONE (unchangetd)
// ===============================
function wireDropZoneIfPresent() {
  const zone = document.getElementById("dropZone");
  const fileInput = document.getElementById("editPhotoFile");
  if (!zone || !fileInput) return;

  zone.addEventListener("click", () => fileInput.click());

  zone.addEventListener("dragover", (e) => {
    e.preventDefault();
    zone.style.background = "#eef2ff";
  });
  zone.addEventListener("dragleave", () => {
    zone.style.background = "";
  });
  zone.addEventListener("drop", async (e) => {
    e.preventDefault();
    zone.style.background = "";
    const f = e.dataTransfer?.files?.[0];
    if (f) await handleDroppedRecipeImage(f);
  });

  fileInput.addEventListener("change", async () => {
    const f = fileInput.files?.[0];
    if (f) await handleDroppedRecipeImage(f);
  });
}

async function handleDroppedRecipeImage(file) {
  const recipeId = ($("#editRecipeId").val() || "").trim();
  const uuid = ($("#editItemId").val() || "").trim();
  if (!recipeId) return alert("Select a recipe first.");
  if (!isUuid(uuid)) return alert("Select a recipe with a valid UUID first.");

  const preview = document.getElementById("editPhotoPreview");
  if (preview) {
    preview.src = URL.createObjectURL(file);
    preview.style.display = "block";
  }

  try {
    const imageUrl = await uploadOneImageAndGetUrl(file);
    $("#editImageUrl").val(imageUrl);
    setHeroImage(imageUrl);

    await putRecipeNow(recipeId, uuid);

    alert("Photo uploaded + attached to recipe.");
    loadRecipes();
  } catch (e) {
    console.error("Drop upload failed:", e);
    alert("Upload/attach failed. Check console.");
  }
}

function uploadOneImageAndGetUrl(file) {
  const userId = ($("#userID").val() || "").trim();
  const userName = ($("#userName").val() || "").trim();
  if (!userId || !userName) {
    return Promise.reject(new Error("Missing userID / userName headers"));
  }

  return $.ajax({
    url: MEDIA_UPLOAD,
    type: "POST",
    data: file,
    processData: false,
    contentType: "application/octet-stream",
    headers: {
      "x-filename": file.name,
      "x-userid": userId,
      "x-username": userName
    }
  }).then((res) => {
    const directUrl = res?.url || res?.Url;
    const filePath = res?.filePath || res?.FilePath;

    if (directUrl) return String(directUrl);
    if (filePath) return buildBlobUrl(filePath);

    throw new Error("MEDIA_UPLOAD did not return url/filePath.");
  });
}

function putRecipeNow(recipeId, uuid) {
  const url = buildAssetUrlFromTemplate(RECIPE_EDIT_TEMPLATE, recipeId, uuid);

  const payload = {
    title: ($("#editTitle").val() || "").trim(),
    description: ($("#editDescription").val() || "").trim(),
    instructions: ($("#editInstructions").val() || "").trim(),
    imageUrl: ($("#editImageUrl").val() || "").trim()
  };

  return $.ajax({
    url,
    type: "PUT",
    data: JSON.stringify(payload),
    contentType: "application/json"
  });
}

// ===============================
//  HERO IMAGE
// ===============================
function setHeroImage(url) {
  const heroImg = document.getElementById("RecipeHeroImage");
  const heroPh = document.getElementById("RecipeHeroPlaceholder");
  if (!heroImg || !heroPh) return;

  const clean = String(url || "").trim();
  if (clean) {
    heroImg.onerror = function () {
      heroImg.style.display = "none";
      heroPh.style.display = "block";
      heroPh.textContent = "Image failed to load (URL/Blob missing).";
    };

    heroImg.src = clean;
    heroImg.style.display = "block";
    heroPh.style.display = "none";
  } else {
    heroImg.removeAttribute("src");
    heroImg.style.display = "none";
    heroPh.style.display = "block";
    heroPh.textContent = "Select a recipe to show its dish photo";
  }
}

// ===============================
//  HELPERS
// ===============================
function normalizeRecipeFromAnyShape(r) {
  const recipeId = String(r.recipeId || r.id || r.RecipeId || r.recipeID || "").trim();
  const title = String(r.title || r.Title || r.name || r.Name || "").trim();
  const description = String(r.description || r.Description || "").trim();
  const instructions = String(r.instructions || r.Instructions || "").trim();

  const ingredients = r.ingredients || r.Ingredients || "";
  const prep_time = r.prep_time ?? r.prepTime ?? r.PrepTime ?? "";
  const cook_time = r.cook_time ?? r.cookTime ?? r.CookTime ?? "";
  const difficulty = r.difficulty || r.Difficulty || "";

  const imageUrl = extractImageUrlFromRecipe(r);

  const candidateIds = [
    r.itemId, r.assetId, r.AssetId, r.uuid, r.UUID,
    r.documentId, r.docId, r.Id, r.id
  ].filter(Boolean);

  const uuid = candidateIds.map(String).find(isUuid) || "";

  return { recipeId, uuid, title, description, instructions, ingredients, prep_time, cook_time, difficulty, imageUrl };
}

function extractImageUrlFromRecipe(r) {
  return (r?.imageUrl || r?.ImageUrl || r?.photoUrl || r?.PhotoUrl || "");
}

function isUuid(value) {
  const s = String(value || "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function addOrReplaceQuery(url, key, value) {
  const u = new URL(url);
  u.searchParams.set(key, value);
  return u.toString();
}

function unwrapMaybeBase64(value) {
  if (value && typeof value === "object" && "$content" in value) {
    try { return atob(value.$content); } catch { return value.$content || ""; }
  }
  return value || "";
}

function buildBlobUrl(filePath) {
  if (!filePath) return "";
  const trimmed = String(filePath).trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const left = (BLOB_ACCOUNT || "").replace(/\/+$/g, "");
  const right = trimmed.replace(/^\/+/g, "");
  return `${left}/${right}`;
}

function isLikelyVideo({ contentType, url, fileName }) {
  const ct = (contentType || "").toLowerCase();
  if (ct.startsWith("video/")) return true;
  const target = ((url || "") + " " + (fileName || "")).toLowerCase();
  return /\.(mp4|m4v|webm|og[gv]|mov|avi)(\?|#|$)/.test(target);
}

function imageFallbackToLink(imgEl, url, label) {
  const card = imgEl.closest(".media-card");
  if (!card) return;
  const thumb = card.querySelector(".media-thumb");
  const errMsg = card.querySelector(".image-error");

  if (thumb) {
    thumb.innerHTML = `<a href="${url}" target="_blank" rel="noopener" class="video-link">${escapeHtml(label || url)}</a>`;
  }
  if (errMsg) {
    errMsg.textContent = "Image failed to load — opened as link instead.";
    errMsg.style.display = "block";
  }
}

function buildAssetUrlFromTemplate(templateUrl, recipeId, uuid) {
  const marker = "/rest/v1/assets/";
  const idx = templateUrl.indexOf(marker);
  if (idx === -1) return templateUrl;

  const before = templateUrl.substring(0, idx + marker.length);
  const after = templateUrl.substring(idx + marker.length);

  const qIndex = after.indexOf("?");
  const pathPart = qIndex >= 0 ? after.substring(0, qIndex) : after;
  const queryPart = qIndex >= 0 ? after.substring(qIndex) : "";

  const parts = pathPart.split("/");
  if (parts.length >= 2) {
    parts[0] = recipeId;
    parts[1] = uuid;
  }
  return `${before}${parts.join("/")}${queryPart}`;
}

function spinnerHtml() {
  return '<div class="spinner-border" role="status"><span class="visually-hidden">Loading...</span></div>';
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function jsSafe(s) {
  return String(s || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}
