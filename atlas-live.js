/* Live GitHub enrichment for atlas.html.
   No credential or token is shipped to the browser: this uses GitHub's public REST API.
   The server-rendered catalog remains available when the API is unavailable. */
(function () {
  "use strict";

  var catalog = window.AtlasCatalog;
  if (!catalog) return;

  var USER = "Biswajit1999";
  var API = "https://api.github.com";
  var projects = catalog.projects;
  var bySlug = catalog.bySlug;
  var escapeHTML = catalog.escapeHTML;

  function fetchJSON(url) {
    return fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/vnd.github+json" }
    }).then(function (response) {
      if (!response.ok) throw new Error("GitHub returned " + response.status);
      return response.json();
    });
  }

  function fetchAllRepos() {
    var repos = [];
    function fetchPage(page) {
      return fetchJSON(API + "/users/" + USER + "/repos?type=owner&sort=updated&direction=desc&per_page=100&page=" + page)
        .then(function (batch) {
          repos = repos.concat(batch);
          return batch.length === 100 ? fetchPage(page + 1) : repos;
        });
    }
    return fetchPage(1);
  }

  function repoType(repo) {
    var text = [repo.name, repo.description || ""].concat(repo.topics || []).join(" ").toLowerCase();
    if (/exoplanet-report/.test(text)) return "exoplanet-report";
    if (/detection-method/.test(text)) return "detection-method";
    if (/\b(game|games|minigame)\b/.test(text)) return "game";
    if (/\b(thesis|dissertation|coursework|notebook|academic)\b/.test(text)) return "research-academic";
    if (/\b(audit|benchmark|reproducib|calibration|readiness)\b/.test(text)) return "research-benchmark";
    if (/\b(lab|simulator|observatory|explorer|visuali[sz]er)\b/.test(text)) return "astro-lab";
    if (/\b(platform|studio|atlas|console|ecosystem|toolkit)\b/.test(text)) return "platform";
    return "repository";
  }

  function liveURL(repo) {
    if (repo.homepage && /^https?:\/\//i.test(repo.homepage)) return repo.homepage;
    return repo.has_pages ? "https://" + USER.toLowerCase() + ".github.io/" + encodeURIComponent(repo.name) + "/" : "";
  }

  function updatedLabel(value) {
    if (!value) return "Update time unavailable";
    var date = new Date(value);
    if (isNaN(date.getTime())) return "Update time unavailable";
    var days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
    if (days === 0) return "Updated today";
    if (days === 1) return "Updated yesterday";
    if (days < 30) return "Updated " + days + " days ago";
    return "Updated " + date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  function previewURL(repo) {
    var version = String(repo.pushed_at || repo.updated_at || "current").replace(/[^0-9a-z]/gi, "");
    return "https://opengraph.githubassets.com/" + version + "/" + repo.full_name;
  }

  function titleFromName(name) {
    return name.replace(/[-_]+/g, " ").replace(/\b\w/g, function (character) { return character.toUpperCase(); });
  }

  function cardProject(repo, order) {
    var type = repoType(repo);
    var repoLiveURL = liveURL(repo);
    var title = titleFromName(repo.name);
    var description = repo.description || "Public GitHub repository. Open the repository for its README, source code, and project documentation.";
    var detail = {
      slug: repo.name,
      type: type,
      status: repo.archived ? "archived" : "active",
      title: title,
      summary: description,
      headline: description,
      category: repo.language || "Software repository",
      tech_or_instruments: [repo.language].filter(Boolean),
      datasets: [], methods: [], molecules: [],
      tags: repo.topics || [],
      github_url: repo.html_url,
      live_report_url: repoLiveURL,
      thumbnail_url: previewURL(repo),
      thumbnail_attribution: repo.name + " repository preview"
    };
    var article = document.createElement("article");
    article.className = "atlas-card reveal in";
    article.dataset.slug = repo.name;
    article.dataset.order = String(order);
    article.dataset.type = type;
    article.dataset.status = detail.status;
    article.dataset.tech = repo.language || "";
    article.dataset.tags = (repo.topics || []).join("|");
    article.dataset.search = [repo.name, title, description, repo.language || "", (repo.topics || []).join(" ")].join(" ").toLowerCase();
    var group = catalog.typeGroups[type] || "tool";
    article.innerHTML =
      '<div class="atlas-card-media"><img src="' + escapeHTML(detail.thumbnail_url) + '" alt="' + escapeHTML(detail.thumbnail_attribution) + '" loading="lazy" width="640" height="360" /></div>' +
      '<div class="atlas-card-body"><div class="kicker"><span class="type-badge" data-type-group="' + escapeHTML(group) + '">' + escapeHTML(catalog.typeLabel(type)) + '</span>' +
      (repo.language ? '<span class="tag">' + escapeHTML(repo.language) + '</span>' : '') + '</div>' +
      '<h3><a href="#" data-open-detail="' + escapeHTML(repo.name) + '">' + escapeHTML(title) + '</a></h3>' +
      '<p>' + escapeHTML(description) + '</p>' +
      '<p class="atlas-card-updated"><time datetime="' + escapeHTML(repo.pushed_at || repo.updated_at) + '">' + escapeHTML(updatedLabel(repo.pushed_at || repo.updated_at)) + '</time></p>' +
      '<div class="atlas-card-links">' + (repoLiveURL ? '<a href="' + escapeHTML(repoLiveURL) + '" target="_blank" rel="noopener">Live</a>' : '') +
      '<a href="' + escapeHTML(repo.html_url) + '" target="_blank" rel="noopener">GitHub</a></div></div>';
    document.getElementById("atlas-grid").appendChild(article);
    return {
      el: article,
      slug: repo.name,
      type: type,
      status: detail.status,
      category: detail.category,
      planetClass: "",
      evidenceStatus: null,
      tech: [repo.language].filter(Boolean),
      tags: repo.topics || [],
      searchText: article.dataset.search,
      detail: detail,
      githubRepo: repo,
      pushedAt: Date.parse(repo.pushed_at || repo.updated_at) || 0
    };
  }

  function updateFreshness(project, repo) {
    var body = project.el.querySelector(".atlas-card-body");
    if (!body) return;
    var line = body.querySelector(".atlas-card-updated");
    if (!line) {
      line = document.createElement("p");
      line.className = "atlas-card-updated";
      body.insertBefore(line, body.querySelector(".atlas-card-links"));
    }
    var updated = repo.pushed_at || repo.updated_at;
    line.innerHTML = '<time datetime="' + escapeHTML(updated) + '">' + escapeHTML(updatedLabel(updated)) + '</time>';
  }

  function enrich(project, repo) {
    project.githubRepo = repo;
    project.pushedAt = Date.parse(repo.pushed_at || repo.updated_at) || 0;
    project.status = repo.archived ? "archived" : "active";
    project.el.dataset.status = project.status;
    project.detail.github_url = repo.html_url;
    project.detail.live_report_url = liveURL(repo) || project.detail.live_report_url || "";
    project.detail.repository_name = repo.name;
    project.detail.repository_description = repo.description || "";
    project.searchText += " " + [repo.name, repo.description || "", repo.language || "", (repo.topics || []).join(" ")].join(" ").toLowerCase();
    updateFreshness(project, repo);
    var githubLink = project.el.querySelector('.atlas-card-links a[href*="github.com"]');
    if (githubLink) githubLink.href = repo.html_url;
  }

  function imageFromReadme(markdown, repo) {
    var candidates = [];
    var htmlPattern = /<img\b[^>]*?src=["']([^"']+)["'][^>]*>/gi;
    var markdownPattern = /!\[[^\]]*\]\((?:<)?([^\s)>]+)(?:>)?(?:\s+["'][^"']*["'])?\)/g;
    var match;
    while ((match = htmlPattern.exec(markdown))) candidates.push(match[1]);
    while ((match = markdownPattern.exec(markdown))) candidates.push(match[1]);
    var selected = candidates.find(function (url) {
      return !/(shields\.io|badge|actions\/workflows|codecov|coveralls|visitor|hits\.seeyoufarm)/i.test(url);
    });
    if (!selected) return "";
    selected = selected.replace(/&amp;/g, "&");
    var githubBlob = selected.match(/^https?:\/\/github\.com\/([^/]+\/[^/]+)\/(?:blob|raw)\/([^/]+)\/(.+)$/i);
    if (githubBlob) return "https://raw.githubusercontent.com/" + githubBlob[1] + "/" + githubBlob[2] + "/" + githubBlob[3];
    if (/^https?:\/\//i.test(selected)) return selected;
    if (/^(data:|#)/i.test(selected)) return "";
    return new URL(selected.replace(/^\//, ""), "https://raw.githubusercontent.com/" + repo.full_name + "/" + repo.default_branch + "/").href;
  }

  function hydrateThumbnail(project) {
    var repo = project.githubRepo;
    if (!repo || project.thumbnailAttempted) return;
    project.thumbnailAttempted = true;
    var readmeURL = "https://raw.githubusercontent.com/" + repo.full_name + "/" + encodeURIComponent(repo.default_branch) + "/README.md";
    fetch(readmeURL, { cache: "force-cache" }).then(function (response) {
      if (!response.ok) throw new Error("README unavailable");
      return response.text();
    }).then(function (markdown) {
      var imageURL = imageFromReadme(markdown, repo);
      if (!imageURL) return;
      var media = project.el.querySelector(".atlas-card-media");
      if (!media) return;
      var image = media.querySelector("img") || document.createElement("img");
      image.loading = "lazy";
      image.width = 640;
      image.height = 360;
      image.alt = project.detail.title + " project banner";
      image.onerror = function () { image.onerror = null; image.src = previewURL(repo); };
      image.src = imageURL;
      if (!image.parentNode) { media.innerHTML = ""; media.appendChild(image); }
      project.detail.thumbnail_url = imageURL;
      project.detail.thumbnail_attribution = project.detail.title + " README banner";
    }).catch(function () { /* keep the curated image, preview, or initials fallback */ });
  }

  function watchThumbnails() {
    if (!("IntersectionObserver" in window)) return;
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var key = (entry.target.dataset.slug || "").toLowerCase();
        var project = bySlug[key];
        if (project && project.githubRepo) {
          var imageURL = project.detail.thumbnail_url || "";
          if (!imageURL || imageURL.indexOf("opengraph.githubassets.com") > -1) hydrateThumbnail(project);
        }
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "240px" });
    projects.forEach(function (project) { observer.observe(project.el); });
  }

  function renderCommits(searchResult, repos) {
    var grid = document.getElementById("atlas-commit-grid");
    if (!grid) return;
    var commits = ((searchResult && searchResult.items) || []).map(function (item) {
      return {
        repo: item.repository.full_name,
        sha: item.sha,
        message: (item.commit.message || "Commit").split("\n")[0],
        date: item.commit.committer.date,
        url: item.html_url
      };
    });
    var seen = {};
    commits = commits.filter(function (commit) {
      if (!commit.sha || seen[commit.sha]) return false;
      seen[commit.sha] = true;
      return true;
    }).slice(0, 6);
    if (!commits.length) {
      commits = repos.slice(0, 6).map(function (repo) {
        return { repo: repo.full_name, sha: "", message: repo.description || "Repository updated", date: repo.pushed_at, url: repo.html_url };
      });
    }
    grid.innerHTML = commits.map(function (commit) {
      var repoName = commit.repo.split("/").pop();
      var url = commit.url || ("https://github.com/" + commit.repo + "/commit/" + commit.sha);
      return '<article class="atlas-commit-card"><span class="atlas-commit-repo">' + escapeHTML(repoName) + '</span>' +
        '<p class="atlas-commit-message">' + escapeHTML(commit.message) + '</p>' +
        '<div class="atlas-commit-meta"><time datetime="' + escapeHTML(commit.date) + '">' + escapeHTML(updatedLabel(commit.date).replace("Updated ", "")) + '</time>' +
        '<a href="' + escapeHTML(url) + '" target="_blank" rel="noopener">' + (commit.sha ? escapeHTML(commit.sha.slice(0, 7)) : "Repository") + '</a></div></article>';
    }).join("");
  }

  function updateStructuredData(repos) {
    var script = document.querySelector('script[type="application/ld+json"]');
    if (!script) return;
    try {
      var data = JSON.parse(script.textContent);
      var curated = {};
      (data.itemListElement || []).forEach(function (entry) {
        var url = entry && entry.item && entry.item.codeRepository;
        if (url) curated[url.toLowerCase()] = entry.item;
      });
      data.numberOfItems = repos.length;
      data.description = repos.length + " current public GitHub repositories spanning scientific software, astrophysics research, interactive labs, and related projects.";
      data.itemListElement = repos.map(function (repo, index) {
        var existing = curated[repo.html_url.toLowerCase()];
        return {
          "@type": "ListItem",
          position: index + 1,
          item: existing || {
            "@type": "SoftwareSourceCode",
            name: repo.name,
            url: liveURL(repo) || repo.html_url,
            description: repo.description || "Public GitHub repository by Biswajit Jana",
            codeRepository: repo.html_url,
            author: { "@type": "Person", name: "Biswajit Jana" }
          }
        };
      });
      script.textContent = JSON.stringify(data);
    } catch (error) { /* retain the valid server-rendered fallback */ }
  }

  function synchronize() {
    var status = document.getElementById("atlas-sync-status");
    Promise.all([
      fetchAllRepos(),
      fetchJSON(API + "/search/commits?q=author%3A" + USER + "&sort=committer-date&order=desc&per_page=6").catch(function () { return { items: [] }; })
    ]).then(function (results) {
      var repos = results[0];
      var commitSearch = results[1];
      var repoIndex = {};
      repos.forEach(function (repo) { repoIndex[repo.name.toLowerCase()] = repo; });

      for (var index = projects.length - 1; index >= 0; index--) {
        var existing = projects[index];
        var repo = repoIndex[existing.slug.toLowerCase()];
        if (repo) {
          enrich(existing, repo);
        } else {
          existing.el.remove();
          delete bySlug[existing.slug.toLowerCase()];
          projects.splice(index, 1);
        }
      }

      repos.forEach(function (repo, index) {
        var key = repo.name.toLowerCase();
        if (bySlug[key]) return;
        var project = cardProject(repo, projects.length + index);
        projects.push(project);
        bySlug[key] = project;
      });

      var total = document.getElementById("atlas-stat-total");
      var live = document.getElementById("atlas-stat-live");
      if (total) total.textContent = String(repos.length);
      if (live) live.textContent = String(repos.filter(function (repo) { return repo.has_pages || repo.homepage; }).length);
      var lead = document.getElementById("atlas-catalog-lead");
      if (lead) lead.textContent = "Search all " + repos.length + " current public repositories. Curated research entries include additional scientific context; newly created repositories appear automatically from GitHub.";
      if (status) {
        status.textContent = "Live GitHub data loaded · " + repos.length + " public repositories · refreshed " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        status.dataset.state = "ready";
      }
      updateStructuredData(repos);
      renderCommits(commitSearch, repos);
      if (window.AtlasBridge) window.AtlasBridge.projectSlugs = projects.map(function (project) { return project.slug; });
      catalog.applyState();
      watchThumbnails();
    }).catch(function () {
      if (status) {
        status.textContent = "GitHub is temporarily unavailable; showing the curated repository snapshot.";
        status.dataset.state = "error";
      }
      var grid = document.getElementById("atlas-commit-grid");
      if (grid) grid.innerHTML = '<p class="atlas-activity-loading">Recent activity could not be loaded. The repository catalog below remains available.</p>';
    });
  }

  synchronize();
})();
