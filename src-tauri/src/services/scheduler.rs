use chrono::{NaiveDate, Utc, Duration};
use serde::{Deserialize, Serialize};

/// Predictive Health Scheduler
/// Auto-schedules medical exams based on supplement protocols and clinical history

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ScheduledExam {
    pub exam_type: String,
    pub reason: String,
    pub scheduled_date: String,
    pub triggered_by: String,
}

/// Rules engine: given a supplement protocol, generate upcoming exam schedule
pub fn generate_exam_schedule(
    supplements: &[SupplementInfo],
    last_labs: &[LabInfo],
) -> Vec<ScheduledExam> {
    let today = Utc::now().date_naive();
    let mut exams = Vec::new();

    for supp in supplements {
        match supp.name.to_lowercase().as_str() {
            // Zinc supplementation → check Zinc/Copper ratio in 3 months
            name if name.contains("zinco") || name.contains("zinc") || name.contains("winfit") => {
                let last_zinc = last_labs.iter()
                    .find(|l| l.marker.to_lowercase().contains("zinc"));

                let months_since = last_zinc
                    .and_then(|l| NaiveDate::parse_from_str(&l.date, "%Y-%m-%d").ok())
                    .map(|d| (today - d).num_days() / 30)
                    .unwrap_or(999);

                if months_since >= 3 {
                    let date = today + Duration::days(7); // Schedule within a week
                    exams.push(ScheduledExam {
                        exam_type: "zinc_copper_panel".to_string(),
                        reason: "Monitorizar rácio Zinco/Cobre após 3 meses de suplementação com Winfit.".to_string(),
                        scheduled_date: date.format("%Y-%m-%d").to_string(),
                        triggered_by: "zinc_supplementation_3mo".to_string(),
                    });
                }

                // Also check ANA for autoimmune (Alopecia Areata)
                let last_ana = last_labs.iter()
                    .find(|l| l.marker.to_lowercase().contains("ana"));

                let months_since_ana = last_ana
                    .and_then(|l| NaiveDate::parse_from_str(&l.date, "%Y-%m-%d").ok())
                    .map(|d| (today - d).num_days() / 30)
                    .unwrap_or(999);

                if months_since_ana >= 6 {
                    let date = today + Duration::days(7);
                    exams.push(ScheduledExam {
                        exam_type: "autoimmune_panel".to_string(),
                        reason: "Painel autoimune (ANA) para monitorizar Alopecia Areata — check semestral.".to_string(),
                        scheduled_date: date.format("%Y-%m-%d").to_string(),
                        triggered_by: "alopecia_areata_6mo".to_string(),
                    });
                }
            }

            // Magnesium → check Magnesium levels + stress markers
            name if name.contains("magnésio") || name.contains("magnesium") || name.contains("bisglicinato") => {
                let last_mg = last_labs.iter()
                    .find(|l| l.marker.to_lowercase().contains("magnesium"));

                let months_since = last_mg
                    .and_then(|l| NaiveDate::parse_from_str(&l.date, "%Y-%m-%d").ok())
                    .map(|d| (today - d).num_days() / 30)
                    .unwrap_or(999);

                if months_since >= 4 {
                    let date = today + Duration::days(14);
                    exams.push(ScheduledExam {
                        exam_type: "magnesium_cortisol_panel".to_string(),
                        reason: "Verificar Magnésio sérico + Cortisol para avaliar recuperação do sistema nervoso.".to_string(),
                        scheduled_date: date.format("%Y-%m-%d").to_string(),
                        triggered_by: "magnesium_supplementation_4mo".to_string(),
                    });
                }
            }

            // Vitamin C → check iron absorption + immune markers
            name if name.contains("vitamina c") || name.contains("vitamin c") || name.contains("vit c") => {
                let last_ferritin = last_labs.iter()
                    .find(|l| l.marker.to_lowercase().contains("ferritin"));

                let months_since = last_ferritin
                    .and_then(|l| NaiveDate::parse_from_str(&l.date, "%Y-%m-%d").ok())
                    .map(|d| (today - d).num_days() / 30)
                    .unwrap_or(999);

                if months_since >= 6 {
                    let date = today + Duration::days(14);
                    exams.push(ScheduledExam {
                        exam_type: "iron_panel".to_string(),
                        reason: "Painel de ferro (Ferritina, Ferro sérico) — Vitamina C aumenta absorção de ferro.".to_string(),
                        scheduled_date: date.format("%Y-%m-%d").to_string(),
                        triggered_by: "vitc_iron_absorption_6mo".to_string(),
                    });
                }
            }

            _ => {}
        }
    }

    // Always: Vitamin D check every 3 months for light-skinned Afro-Brazilian in Portugal
    let last_vitd = last_labs.iter()
        .find(|l| l.marker.to_lowercase().contains("vitamin d"));

    let months_since_vitd = last_vitd
        .and_then(|l| NaiveDate::parse_from_str(&l.date, "%Y-%m-%d").ok())
        .map(|d| (today - d).num_days() / 30)
        .unwrap_or(999);

    if months_since_vitd >= 3 {
        let date = today + Duration::days(7);
        exams.push(ScheduledExam {
            exam_type: "vitamin_d_panel".to_string(),
            reason: "Verificação trimestral de Vitamina D — essencial para fototipo lightskin em Portugal (latitude alta, UV baixo no inverno).".to_string(),
            scheduled_date: date.format("%Y-%m-%d").to_string(),
            triggered_by: "vitd_quarterly_lightskin_portugal".to_string(),
        });
    }

    // Thyroid check every 6 months (stress-induced thyroid issues)
    let last_tsh = last_labs.iter()
        .find(|l| l.marker.to_lowercase().contains("tsh"));

    let months_since_tsh = last_tsh
        .and_then(|l| NaiveDate::parse_from_str(&l.date, "%Y-%m-%d").ok())
        .map(|d| (today - d).num_days() / 30)
        .unwrap_or(999);

    if months_since_tsh >= 6 {
        let date = today + Duration::days(14);
        exams.push(ScheduledExam {
            exam_type: "thyroid_panel".to_string(),
            reason: "Painel tiroide (TSH, T3, T4) — monitorizar impacto do burnout crónico na tiroide.".to_string(),
            scheduled_date: date.format("%Y-%m-%d").to_string(),
            triggered_by: "burnout_thyroid_6mo".to_string(),
        });
    }

    exams
}

#[derive(Debug)]
#[allow(dead_code)]
pub struct SupplementInfo {
    pub name: String,
    pub started_date: String,
}

#[derive(Debug)]
pub struct LabInfo {
    pub marker: String,
    pub date: String,
}
