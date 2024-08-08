grammar FoundrySystemDesignLanguage

entry Entry:
    config=Config documents+=Document*;

Config:
    "config" name=ID "{" body+=(ConfigExpression)* "}";

Document:
    Actor | Item;

Actor:
    "actor" name=ID ClassBlock;

Item:
    "item" name=ID ClassBlock;


fragment ClassBlock:
    "{" body+=(ClassExpression | Section)* "}";

Section:
    "section" name=ID "{" body+=ClassExpression* "}";

ConfigExpression:
    type=("label" | "id" | "author" | "description") "=" value=STRING;

ClassExpression:
    (Property | Action | Access | IfStatement );

Property:
    (StringExp | NumberExp | HtmlExp | BooleanExp | ResourceExp | AttributeExp | DamageTrackExp | PipsExp | DocumentArrayExp | SingleDocumentExp);

Access:
    "self." property=[Property:ID] ("." subProperties+=ID)*;

FleetingAccess:
    variable=[VariableExpression] ("." subProperty=ID)?;

ElseIf:
    "else" "if" "(" expression=WhenExpressions ")" method=MethodBlock;

IfStatement:
    "if" "(" expression=WhenExpressions ")" method=MethodBlock
    elseIfs+=(ElseIf)*
    ("else" elseMethod=MethodBlock)?
    ;

Assignment:
    (ExpressionAssignment | IncrementAssignment | DecrementAssignment | IncrementValAssignment | DecrementValAssignment);

ExpressionAssignment:
    "self." property=[Property:ID] ("." subProperty=ID)? "=" exp=Expression;

IncrementAssignment:
    "self." property=[Property:ID] ("." subProperty=ID)? "++";

DecrementAssignment:
    "self." property=[Property:ID] ("." subProperty=ID)? "--";

IncrementValAssignment:
    "self." property=[Property:ID] ("." subProperty=ID)? "+=" exp=Expression;

DecrementValAssignment:
    "self." property=[Property:ID] ("." subProperty=ID)? "-=" exp=Expression;

fragment Parent:
    "parent" ( "." property=ID | "[" "self." propertyLookup=[Property:ID] "]" ) ("." subProperty=ID)?;

ParentAccess:
    Parent;

ParentAssignment:
    (ParentExpressionAssignment | ParentIncrementAssignment | ParentDecrementAssignment | ParentIncrementValAssignment | ParentDecrementValAssignment);

ParentExpressionAssignment:
    Parent "=" exp=Expression;

ParentIncrementAssignment:
    Parent "++";

ParentDecrementAssignment:
    Parent "--";

ParentIncrementValAssignment:
    Parent "+=" exp=Expression;

ParentDecrementValAssignment:
    Parent "-=" exp=Expression;

ItemAccess:
    "item" "." property=ID ("." subProperty=ID)?;

VariableAssignment:
    (VariableExpressionAssignment | VariableIncrementAssignment | VariableDecrementAssignment | VariableIncrementValAssignment | VariableDecrementValAssignment);

VariableExpressionAssignment:
    variable=[VariableExpression:ID] "=" exp=Expression;

VariableIncrementAssignment:
    variable=[VariableExpression:ID] "++";

VariableDecrementAssignment:
    variable=[VariableExpression:ID] "--";

VariableIncrementValAssignment:
    variable=[VariableExpression:ID] "+=" exp=Expression;

VariableDecrementValAssignment:
    variable=[VariableExpression:ID] "-=" exp=Expression;

Action:
    "action" name=ID ("(" conditions+=ActionCondition ("," conditions+=ActionCondition)* ")")? method=MethodBlock;

ActionCondition:
    (DisabledCondition | HiddenCondition | IconParam | ColorParam);

DisabledCondition:
    "disabled:" when=WhenExpressions;

HiddenCondition:
    "hidden:" when=WhenExpressions;

WhenExpressions:
    (ShorthandComparisonExpression | ComparisonExpression);

Each:
    'each' var=Parameter 'in' collection=Property method=MethodBlock;

MethodBlock:
    "{" body+=(MethodBlockExpression)* "}";

Roll:
    "roll" "(" parts+=(Expression)* ")";

MethodBlockExpression:
    (VariableExpression | Assignment | ParentAssignment | VariableAssignment | IncrementAssignment | ReturnExpression | IfStatement | JS | ChatCard);

JS: js=JS_LINE;

ChatCard:
    "chat" name=ID ("(" "template:" path=STRING ")")? body=ChatBlock;

ChatBlock:
    "{" chatExp+=(ChatBlockExpression)* "}";

ChatBlockExpression:
    type=("tag")? (Access | FleetingAccess | ParentAccess | Expression);

VariableExpression:
    type=("fleeting" | "eternal") name=ID "=" value=(Expression | Roll);

ReturnExpression:
    "return" value=Expression;

Expression: AddOrSubtract;

AddOrSubtract infers Expression:
    MultiplyOrDivide ({infer BinaryExpression.e1=current} op=('+'|'-') e2=MultiplyOrDivide)*;

MultiplyOrDivide infers Expr:
    PrimitiveExpression ({infer BinaryExpression.e1=current} op=('*'|'/') e2=PrimitiveExpression)*;

PrimitiveExpression: Literal | Ref | Roll | Group | NegExpression | Access | JS | FleetingAccess | ParentAccess | ItemAccess ;

ComparisonExpression:
    e1=Expression term=("<" | ">" | "<=" | ">=" | "equals" | "==") e2=Expression;

ShorthandComparisonExpression:
    e1=Expression term=("exists");

// literal
Literal:        val=(INT|STRING|DICE|NOTHING);
// cross-reference to a parameter
Ref:        val=[VariableExpression:ID];
// grouped expression with parentheses
Group:      '(' ge=Expression ')';
// negated expression
NegExpression:    '-' ne=Expression;

StringExp: ExpressionModifier "string" name=ID ("(" "choices:" "[" (choices+=STRING ("," choices+=STRING)*)? "]" ")")?;

NumberExp: ExpressionModifier "number" name=ID NumberParameters;

BooleanExp: ExpressionModifier "boolean" name=ID;

HtmlExp: ExpressionModifier "html" name=ID;

ResourceExp: ExpressionModifier "resource" name=ID ("(" ("max:" max=(MethodBlock | INT))? & ("color:" color=HEX_COLOR)? ")")?;

AttributeExp: ExpressionModifier "attribute" name=ID "(" "min:" min=INT "," "max:" max=INT "," "mod:" method=MethodBlock ")";

PipsExp: ExpressionModifier "pips" name=ID "(" "max:" max=(MethodBlock | INT) ("," "initial:" initial=(MethodBlock | INT))? ("," "style:" style=("squares" | "circles"))? ")";

DamageTrackExp: ExpressionModifier "damageTrack" name=ID "(" "max:" max=(MethodBlock | INT) "," "types:" "[" (types+=STRING ("," types+=STRING)*)? "]" ")";

DocumentArrayExp: ExpressionModifier document=[Document:ID] "[]" name=ID ("(" params+=(IconParam|WhereParam) ")")?;

SingleDocumentExp: ExpressionModifier document=[Document:ID] name=ID;

fragment ExpressionModifier:
    (modifier=("hidden" | "readonly"))?;

fragment NumberParameters:
    ("(" params+=NumberParameter* ("," params+=NumberParameter)* ")")?;

NumberParameter:
    (NumberParamMin | NumberParamInitial | NumberParamValue | NumberParamMax | ColorParam | IconParam);

NumberParamMin:
    "min:" value=(MethodBlock | INT);

NumberParamInitial:
    "initial:" value=(INT);

NumberParamValue:
    "value:" value=(MethodBlock | INT);

NumberParamMax:
    "max:" value=(MethodBlock | INT);

ColorParam:
    "color:" value=HEX_COLOR;

IconParam:
    "icon:" value=STRING;

WhereParam:
    "where:" value=WhenExpressions;

Parameter: name=ID;

hidden terminal WS: /\s+/;
terminal NOTHING: "nothing";
terminal DICE: /(\d+)?d(\d+)(\w+)?/;
terminal ID: /[_a-zA-Z][\w_]*/;
terminal INT returns number: /(-)?[0-9]+/;
terminal STRING: /"(\\.|[^"\\])*"|'(\\.|[^'\\])*'/;
terminal JS_LINE: /\@js\{.+\}/;
terminal HEX_COLOR: /#[0-9a-fA-F]{6}/;

hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal SL_COMMENT: /\/\/[^\n\r]*/;
