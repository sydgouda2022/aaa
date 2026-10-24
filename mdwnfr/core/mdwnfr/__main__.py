"""Native Python smoke test: python -m mdwnfr."""
import json
from .document import new_document,transaction
from .layout import layout_document

d=new_document()
d=transaction(d,{"op":"insert_word","signs":["𓅓","𓏏"]})
print(json.dumps({"name":"MdwNfr","revision":d["revision"],
                  "layout":layout_document(d)["pages"][0]["columns"][0]["placements"][0]["quadrat"]},
                 ensure_ascii=False,indent=2))
