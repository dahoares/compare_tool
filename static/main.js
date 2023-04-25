$(".clone-btn").click(function () {
  var repo_id = $(this).data("repo");
  var lastCharacterOfRepoId = repo_id.slice(-1);
  var repo_url = $("#repo-url" + lastCharacterOfRepoId).val();

  var data = {
    repo_url: repo_url,
    repo_id: repo_id,
  };

  $.ajax({
    url: "/clone",
    method: "POST",
    data: JSON.stringify(data),
    processData: false,
    contentType: "application/json",
    success: function (data) {
      var branch_select = $("#branch" + lastCharacterOfRepoId);
      branch_select.empty();
      data.branches.forEach(function (branch) {
        // Verwijder 'origin/' prefix van remote branches
        var display_branch = branch.replace(/^origin\//, '');
        branch_select.append($("<option>").val(branch).text(display_branch));
      });
      branch_select.prop("disabled", false);
    },
  });
});

$(".select-branch-btn").click(function () {
  var repo_id = $(this).data("repo");
  var lastCharacterOfRepoId = repo_id.slice(-1);
  var branch = $("#branch" + lastCharacterOfRepoId).val();

  var data = {
    repo_id: repo_id,
    branch: branch
  };
  $.ajax({
    type: "POST",
    url: "/switch_branch",
    data: JSON.stringify(data),
    contentType: "application/json",
    success: function (response) {
      console.log("Switched to branch:", data.branch);
      getFiles(repo_id); // Get files after switching branches
    },
    error: function (error) {
      console.log("Error:", error);
    }
  });
});

function getFiles(repo_id) {
  $.get('/get_files', { repo_id: repo_id }, function (response) {
    var lastCharacterOfRepoId = repo_id.slice(-1);
    var fileDropdown = $('#file' + lastCharacterOfRepoId);
    fileDropdown.empty();
    response.files.forEach(function (file) {
      fileDropdown.append($("<option>").val(file).text(file));
    });
    fileDropdown.prop("disabled", false);
    checkFilesSelected(); // Voeg deze regel toe om te controleren of beide bestanden zijn geselecteerd
  });
}

function checkFilesSelected() {
  var file1Selected = $("#file1").val();
  var file2Selected = $("#file2").val();

  if (file1Selected && file2Selected) {
    $("#compare-btn").prop("disabled", false);
  } else {
    $("#compare-btn").prop("disabled", true);
  }
}

$("#file1, #file2").change(function () {
  checkFilesSelected();
});

$("#compare-btn").click(function () {
  var file1 = $("#file1").val();
  var file2 = $("#file2").val();
  compareFiles(file1, file2);
});

function compareFiles(file1, file2) {
  var repo1 = "repo1";
  var repo2 = "repo2";

  // Get file content for both files
  $.when(
    $.get('/get_file_content', { repo_id: repo1, file_path: file1 }),
    $.get('/get_file_content', { repo_id: repo2, file_path: file2 })
  ).done(function (file1Content, file2Content) {
    var file1Data = jsyaml.load(file1Content[0]);
    var file2Data = jsyaml.load(file2Content[0]);

    // Get the dependencies
    var dependencies1 = getDependenciesFromChartYaml(file1Content[0]);
    var dependencies2 = getDependenciesFromChartYaml(file2Content[0]);

    // Clear tables
    $("#differences-table tbody").empty();
    $("#new-keys-table tbody").empty();
    $("#obsolete-keys-table tbody").empty();
    $("#similarities-table tbody").empty();

    // Perform comparison and populate the tables
    compareDifferences(file1Data, file2Data, '', dependencies1, dependencies2);
    compareNewKeys(file1Data, file2Data, '', dependencies1);
    compareObsoleteKeys(file1Data, file2Data, '', dependencies2);
    compareSimilarities(file1Data, file2Data, '', dependencies1, dependencies2);
  });
}

function compareDifferences(file1Data, file2Data, parentKey = '', dependencies1 = {}, dependencies2 = {}) {
  var differencesTable = $("#differences-table tbody");

  for (var key in file1Data) {
    if (file2Data.hasOwnProperty(key)) {
      var fullKey = parentKey ? parentKey + '.' + key : key;
      var displayKey = fullKey.replace(/\.(\d)\./, (match, depIndex) => {
        const depName1 = dependencies1[depIndex] && dependencies1[depIndex].name;
        const depName2 = dependencies2[depIndex] && dependencies2[depIndex].name;
        return `dependencies.${depName1 === depName2 ? depName1 : depIndex}.`;
      });
      if (typeof file1Data[key] === 'object' && typeof file2Data[key] === 'object') {
        compareDifferences(file1Data[key], file2Data[key], fullKey, dependencies1, dependencies2);
      } else if (file1Data[key] !== file2Data[key]) {
        differencesTable.append(`<tr><td>${displayKey}</td><td data-bs-toggle="tooltip" title="${objectToString(file1Data[key])}">${objectToString(file1Data[key])}</td><td data-bs-toggle="tooltip" title="${objectToString(file2Data[key])}">${objectToString(file2Data[key])}</td></tr>`);
      }
    }
  }
}

function compareNewKeys(file1Data, file2Data, parentKey = '', dependencies1 = {}, dependencies2 = {}) {
  var newKeysTable = $("#new-keys-table tbody");

  for (var key in file1Data) {
    var fullKey = parentKey ? parentKey + '.' + key : key;
    var displayKey = fullKey.replace(/\.(\d)\./, (match, depIndex) => {
      const depName1 = dependencies1[depIndex] && dependencies1[depIndex].name;
      const depName2 = dependencies2[depIndex] && dependencies2[depIndex].name;
      return `dependencies.${depName1 === depName2 ? depName1 : depIndex}.`;
    });
    if (!file2Data.hasOwnProperty(key)) {
      newKeysTable.append(`<tr><td>${displayKey}</td><td data-bs-toggle="tooltip" title="${objectToString(file1Data[key])}">${objectToString(file1Data[key])}</td></tr>`);
    } else if (typeof file1Data[key] === 'object' && typeof file2Data[key] === 'object') {
      compareNewKeys(file1Data[key], file2Data[key], fullKey, dependencies1, dependencies2);
    }
  }
}

function compareObsoleteKeys(file1Data, file2Data, parentKey = '', dependencies1 = {}, dependencies2 = {}) {
  var obsoleteKeysTable = $("#obsolete-keys-table tbody");

  for (var key in file2Data) {
    var fullKey = parentKey ? parentKey + '.' + key : key;
    var displayKey = fullKey.replace(/\.(\d)\./, (match, depIndex) => {
      const depName1 = dependencies1[depIndex] && dependencies1[depIndex].name;
      const depName2 = dependencies2[depIndex] && dependencies2[depIndex].name;
      return `dependencies.${depName1 === depName2 ? depName1 : depIndex}.`;
    });
    if (!file1Data.hasOwnProperty(key)) {
      obsoleteKeysTable.append(`<tr><td>${displayKey}</td><td data-bs-toggle="tooltip" title="${objectToString(file2Data[key])}">${objectToString(file2Data[key])}</td></tr>`);
    } else if (typeof file1Data[key] === 'object' && typeof file2Data[key] === 'object') {
      compareObsoleteKeys(file1Data[key], file2Data[key], fullKey, dependencies1, dependencies2);
    }
  }
}

function compareSimilarities(file1Data, file2Data, parentKey = '', dependencies1 = {}, dependencies2 = {}) {
  var similaritiesTable = $("#similarities-table tbody"); for (var key in file1Data) {
    if (file2Data.hasOwnProperty(key)) {
      var fullKey = parentKey ? parentKey + '.' + key : key;
      var displayKey = fullKey.replace(/.(\d)./, (match, depIndex) => {
        const depName1 = dependencies1[depIndex] && dependencies1[depIndex].name;
        const depName2 = dependencies2[depIndex] && dependencies2[depIndex].name;
        return `dependencies.${depName1 === depName2 ? depName1 : depIndex}.`;
      });
      if (typeof file1Data[key] === 'object' && typeof file2Data[key] === 'object') {
        compareSimilarities(file1Data[key], file2Data[key], fullKey, dependencies1, dependencies2);
      } else if (file1Data[key] === file2Data[key]) {
        similaritiesTable.append(`<tr><td>${displayKey}</td><td data-bs-toggle="tooltip" title="${objectToString(file1Data[key])}">${objectToString(file1Data[key])}</td><td data-bs-toggle="tooltip" title="${objectToString(file2Data[key])}">${objectToString(file2Data[key])}</td></tr>`);
      }
    }
  }
}




function getDependenciesFromChartYaml(chartYaml) {
  const chartData = jsyaml.load(chartYaml);
  return chartData.dependencies || [];
}

$(function () {
  $('[data-bs-toggle="tooltip"]').tooltip();
});

function objectToString(obj) {
  if (typeof obj === 'object') {
    return JSON.stringify(obj, null, 2);
  }
  return obj;
}