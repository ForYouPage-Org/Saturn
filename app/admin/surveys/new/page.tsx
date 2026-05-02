"use client";

import { SurveyEditor } from "../_editor";

export default function NewSurvey() {
  return (
    <SurveyEditor
      isNew
      initial={{
        slug: "",
        title: "",
        category: "esm",
        description: "",
        instructions: "",
        active: true,
        questions: [],
      }}
    />
  );
}
