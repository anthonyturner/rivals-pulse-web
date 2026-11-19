$ErrorActionPreference = "Stop"

$heroes = @(
  @{ Name = "Adam Warlock"; Page = "Adam Warlock" },
  @{ Name = "Angela"; Page = "Angela" },
  @{ Name = "Black Cat"; Page = "Black Cat" },
  @{ Name = "Black Panther"; Page = "Black Panther" },
  @{ Name = "Black Widow"; Page = "Black Widow" },
  @{ Name = "Blade"; Page = "Blade" },
  @{ Name = "Hulk"; Page = "Hulk" },
  @{ Name = "Captain America"; Page = "Captain America" },
  @{ Name = "Cloak & Dagger"; Page = "Cloak & Dagger" },
  @{ Name = "Daredevil"; Page = "Daredevil" },
  @{ Name = "Deadpool"; Page = "Deadpool" },
  @{ Name = "Devil Dinosaur"; Page = "Devil Dinosaur" },
  @{ Name = "Doctor Strange"; Page = "Doctor Strange" },
  @{ Name = "Elsa Bloodstone"; Page = "Elsa Bloodstone" },
  @{ Name = "Emma Frost"; Page = "Emma Frost" },
  @{ Name = "Gambit"; Page = "Gambit" },
  @{ Name = "Groot"; Page = "Groot" },
  @{ Name = "Hawkeye"; Page = "Hawkeye" },
  @{ Name = "Hela"; Page = "Hela" },
  @{ Name = "Human Torch"; Page = "Human Torch" },
  @{ Name = "Invisible Woman"; Page = "Invisible Woman" },
  @{ Name = "Iron Fist"; Page = "Iron Fist" },
  @{ Name = "Iron Man"; Page = "Iron Man" },
  @{ Name = "Jeff the Land Shark"; Page = "Jeff the Land Shark" },
  @{ Name = "Loki"; Page = "Loki" },
  @{ Name = "Luna Snow"; Page = "Luna Snow" },
  @{ Name = "Magik"; Page = "Magik" },
  @{ Name = "Magneto"; Page = "Magneto" },
  @{ Name = "Mantis"; Page = "Mantis" },
  @{ Name = "Mister Fantastic"; Page = "Mister Fantastic" },
  @{ Name = "Moon Knight"; Page = "Moon Knight" },
  @{ Name = "Namor"; Page = "Namor" },
  @{ Name = "Peni Parker"; Page = "Peni Parker" },
  @{ Name = "Phoenix"; Page = "Phoenix" },
  @{ Name = "Psylocke"; Page = "Psylocke" },
  @{ Name = "Rocket Raccoon"; Page = "Rocket Raccoon" },
  @{ Name = "Rogue"; Page = "Rogue" },
  @{ Name = "Scarlet Witch"; Page = "Scarlet Witch" },
  @{ Name = "Spider-Man"; Page = "Spider-Man" },
  @{ Name = "Squirrel Girl"; Page = "Squirrel Girl" },
  @{ Name = "Star-Lord"; Page = "Star-Lord" },
  @{ Name = "Storm"; Page = "Storm" },
  @{ Name = "The Punisher"; Page = "The Punisher" },
  @{ Name = "The Thing"; Page = "The Thing" },
  @{ Name = "Thor"; Page = "Thor" },
  @{ Name = "Ultron"; Page = "Ultron" },
  @{ Name = "Venom"; Page = "Venom" },
  @{ Name = "White Fox"; Page = "White Fox" },
  @{ Name = "Winter Soldier"; Page = "Winter Soldier" },
  @{ Name = "Wolverine"; Page = "Wolverine" }
)

function ConvertTo-Slug([string]$value) {
  return ($value.ToLowerInvariant() -replace "&", "and" -replace "[^a-z0-9]+", "-" -replace "^-|-$", "")
}

function Get-WikiText([string]$page) {
  $encoded = [uri]::EscapeDataString($page)
  $url = "https://marvelrivals.fandom.com/api.php?action=parse&page=$encoded&prop=wikitext&format=json"
  $response = Invoke-RestMethod -Uri $url
  if ($response.error) {
    return ""
  }

  return $response.parse.wikitext."*"
}

function Remove-WikiMarkup([string]$value) {
  if ([string]::IsNullOrWhiteSpace($value)) {
    return ""
  }

  $text = $value -replace "<br\s*/?>", " " `
    -replace "<[^>]+>", "" `
    -replace "\{\{ATC\|[^|}]+\|([^}]+)\}\}", '$1' `
    -replace "\{\{Audio\|[^}]+\}\}", "" `
    -replace "\[\[File:[^\]]+\]\]", "" `
    -replace "\[\[[^|\]]+\|([^\]]+)\]\]", '$1' `
    -replace "\[\[([^\]]+)\]\]", '$1' `
    -replace "'''", "" `
    -replace "''", "" `
    -replace "&amp;", "&" `
    -replace "&nbsp;", " " `
    -replace "\s+", " "

  return $text.Trim()
}

function Get-Field([string]$text, [string]$field) {
  $match = [regex]::Match($text, "(?m)^\|\s*$field\s*=\s*(.+)$")
  if ($match.Success) {
    return (Remove-WikiMarkup $match.Groups[1].Value)
  }

  return ""
}

function Get-OfficialSummary([string]$text, [string]$name, [string]$role) {
  $quote = [regex]::Match($text, "\{\{Quote\|(.+?)\|Official description\}\}", "Singleline")
  if ($quote.Success) {
    return Remove-WikiMarkup $quote.Groups[1].Value
  }

  return "$name is a $role hero in Marvel Rivals."
}

function Get-SectionBullets([string]$text, [string]$sectionName, [int]$take = 3) {
  $section = [regex]::Match($text, "==Overview==.*?===$sectionName===\s*(.*?)(?=\n===|\n==)", "Singleline")
  if (-not $section.Success) {
    return @()
  }

  $bullets = @()
  foreach ($line in ($section.Groups[1].Value -split "`n")) {
    if ($line -match "^\*\s+(.+)") {
      $clean = Remove-WikiMarkup $Matches[1]
      $sentence = ($clean -split "(?<=[.!?])\s+")[0]
      if ($sentence.Length -gt 96) {
        $sentence = $sentence.Substring(0, 96).TrimEnd() + "..."
      }
      if ($sentence.Length -gt 0) {
        $bullets += $sentence
      }
    }
  }

  return @($bullets | Select-Object -First $take)
}

function Get-Abilities([string]$page) {
  $templateText = Get-WikiText "Template:Abilities/$page"
  if ([string]::IsNullOrWhiteSpace($templateText)) {
    return @()
  }

  $references = [regex]::Matches($templateText, "SkillTable\|(?:1=)?([^}|]+)")
  if ($references.Count -gt 0 -and -not [regex]::IsMatch($templateText, "(?m)^\s*\|name\s*=")) {
    $merged = ""
    foreach ($reference in ($references | Select-Object -First 2)) {
      $target = $reference.Groups[1].Value.Trim()
      $targetText = Get-WikiText "Template:$target"
      if (-not [string]::IsNullOrWhiteSpace($targetText)) {
        $merged += "`n$targetText"
      }
    }
    if ($merged.Trim().Length -gt 0) {
      $templateText = $merged
    }
  }

  $currentType = "Ability"
  $abilities = @()
  foreach ($line in ($templateText -split "`n")) {
    $title = [regex]::Match($line, "\{\{Skill/Title\|([^}]+)\}\}")
    if ($title.Success) {
      $currentType = Remove-WikiMarkup $title.Groups[1].Value
      continue
    }

    $name = [regex]::Match($line, "^\s*\|name\s*=\s*(.+)$")
    if ($name.Success) {
      $cleanName = Remove-WikiMarkup $name.Groups[1].Value
      if ($cleanName.Length -gt 0) {
        $abilities += [ordered]@{
          name = $cleanName
          type = $currentType
          description = ""
        }
      }
      continue
    }

    $description = [regex]::Match($line, "^\s*\|description\s*=\s*(.+)$")
    if ($description.Success -and $abilities.Count -gt 0) {
      $cleanDescription = Remove-WikiMarkup $description.Groups[1].Value
      if ($cleanDescription.Length -gt 140) {
        $cleanDescription = $cleanDescription.Substring(0, 140).TrimEnd() + "..."
      }
      $abilities[$abilities.Count - 1].description = $cleanDescription
    }
  }

  $normal = @($abilities | Where-Object { $_.type -eq "Normal Attack" } | Select-Object -First 1)
  $ultimate = @($abilities | Where-Object { $_.type -eq "Abilities" -and ($_.name -match "^[A-Z].*" -or $_.description -match "ultimate|Energy Cost") } | Select-Object -First 1)
  $utility = @($abilities | Where-Object { $_.type -eq "Abilities" } | Select-Object -Skip 1 -First 1)

  $picked = @()
  $picked += $normal
  $picked += $ultimate
  $picked += $utility

  if ($picked.Count -lt 3) {
    $picked += @($abilities | Where-Object { $picked.name -notcontains $_.name } | Select-Object -First (3 - $picked.Count))
  }

  return @($picked | Select-Object -First 3)
}

function Get-Synergies([string]$text) {
  $synergies = @()
  $dash = [char]0x2014
  $pattern = [regex]::Escape("$dash with ") + "([^\n]+)"
  $teamUps = [regex]::Matches($text, $pattern)
  foreach ($teamUp in $teamUps) {
    $names = Remove-WikiMarkup $teamUp.Groups[1].Value
    foreach ($name in ($names -split "\s+and\s+|,\s*")) {
      $clean = $name.Trim()
      if ($clean.Length -gt 0) {
        $synergies += $clean
      }
    }
  }
  return @($synergies | Select-Object -Unique -First 3)
}

function Get-Counters([string]$role) {
  switch ($role) {
    "Vanguard" { return @("Long-range poke", "High-mobility duelists", "Sustained anti-shield pressure") }
    "Strategist" { return @("Dive pressure", "Line-of-sight denial", "Burst focus") }
    "Multi-Role" { return @("Cooldown tracking", "Role mismatch pressure", "Coordinated focus fire") }
    default { return @("Crowd control", "Protective barriers", "Focused peel") }
  }
}

$result = foreach ($hero in $heroes) {
  $text = Get-WikiText $hero.Page
  $role = Get-Field $text "role"
  if ($role -match "Vanguard" -and $role -match "Duelist" -and $role -match "Strategist") {
    $role = "Multi-Role"
  }
  if ($role -eq "") {
    $role = "Duelist"
  }

  $difficultyText = Get-Field $text "difficulty"
  $difficulty = 3
  [void][int]::TryParse($difficultyText, [ref]$difficulty)

  $strengths = @(Get-SectionBullets $text "Strengths")
  if ($strengths.Count -eq 0) {
    $strengths = switch ($role) {
      "Vanguard" { @("Creates space for the team", "Absorbs pressure", "Controls close fights") }
      "Strategist" { @("Supports allies", "Stabilizes team fights", "Adds utility from the backline") }
      "Multi-Role" { @("Adapts to different team needs", "Changes role profile", "Flexible fight planning") }
      default { @("Deals reliable damage", "Pressures exposed targets", "Creates elimination windows") }
    }
  }

  $weaknesses = @(Get-SectionBullets $text "Weaknesses")
  if ($weaknesses.Count -eq 0) {
    $weaknesses = switch ($role) {
      "Vanguard" { @("Can be kited", "Punished by split angles", "Needs support timing") }
      "Strategist" { @("Vulnerable to dives", "Needs safe positioning", "Struggles when isolated") }
      "Multi-Role" { @("Requires role awareness", "Can be punished during swaps", "Needs cooldown discipline") }
      default { @("Punished by crowd control", "Needs clean angles", "Can struggle into heavy peel") }
    }
  }

  $synergies = @(Get-Synergies $text)
  if ($synergies.Count -eq 0) {
    $synergies = switch ($role) {
      "Vanguard" { @("Strategists", "Backline duelists", "Area damage heroes") }
      "Strategist" { @("Vanguards", "Dive duelists", "Sustained damage heroes") }
      "Multi-Role" { @("Flexible team comps", "Frontline anchors", "Tempo supports") }
      default { @("Vanguards", "Strategists", "Crowd-control heroes") }
    }
  }

  [ordered]@{
    id = ConvertTo-Slug $hero.Name
    name = $hero.Name
    role = $role
    difficulty = $difficulty
    summary = Get-OfficialSummary $text $hero.Name $role
    playstyle = "Use $($hero.Name) as a $role around cover, cooldown timing, and team follow-up."
    strengths = @($strengths | Select-Object -First 3)
    weaknesses = @($weaknesses | Select-Object -First 3)
    counters = @(Get-Counters $role)
    synergies = @($synergies | Select-Object -First 3)
    abilities = @(Get-Abilities $hero.Page)
  }
}

$outputPath = Join-Path $PSScriptRoot "..\data\seeds\heroes.mock.json"
$result | ConvertTo-Json -Depth 8 | Set-Content -Path $outputPath -Encoding utf8
Write-Host "Wrote $($result.Count) heroes to $outputPath"
