There's a variety of Field types and other children you can define on Documents.

## Standardized Fields

The docs below will reference "standardized" fields. A goal of ISDL is that you should't have to remember what fields do what for standard features. Not all fields currently meet that goal, but when they do, they do the following:

### Visibility Tags

Standardized fields support the following shorthand modifiers:
* `hidden` - Generates data models and preparation, but does not render on the sheet. Example: `hidden number TotalDeaths`
* `readonly` - Prevents the user from modifying this value, even in Edit Mode. Active Effects can still effect this value. Example: `readonly number PassivePerception`
* `unlocked` - Allows the field to be editted even outside of Edit Mode. Example: `unlocked number Bonus`
* `locked` - Locked fields are readonly, nor can Active Effects edit them. Example: `locked number TotalManaCost`

Here's a handy chart about visibility & permissions. Tags marked with 🤔 are planned and not yet implemented.

| **Syntax**               	| **GM**                           	| **Owner**                        	| **Viewer**              	| **Active Effects**         	|
|--------------------------	|----------------------------------	|----------------------------------	|-------------------------	|----------------------------	|
| unlocked                 	| ✅Always Read / Write             	| ✅Always Read / Write             	| 👁️Read                   	| ✅Can edit                  	|
| *default* (no tag)                  	| 📝Read / Write based on edit mode 	| 📝Read / Write based on edit mode 	| 👁️Read                   	| ✅Can edit                  	|
| secret 🤔                   	| 📝Read / Write based on edit mode 	| 📝Read / Write based on edit mode 	| ❌Can’t see              	| ✅Can edit                  	|
| edit                     	| 📝Read / Write only in edit mode  	| 📝Read / Write only in edit mode  	| 👁️Read only in edit mode 	| ✅Can edit                  	|
| gmEdit 🤔                   	| 📝Read / Write based on edit mode 	| 👁️Read                            	| 👁️Read                   	| 🧙GM’s making AE’s can edit 	|
| gmOnly 🤔                   	| 📝Read / Write based on edit mode 	| ❌Can’t see                       	| ❌Can’t see              	| 🧙GM’s making AE’s can edit 	|
| locked (also calculated) 	| 👁️Read                            	| 👁️Read                            	| 👁️Read                   	| ❌Can not edit              	|
| hidden                   	| ❌Can’t see                       	| ❌Can’t see                       	| ❌Can’t see              	| ✅Can edit                  	|


### Parameters

The shorthands are always true, but sometimes you want to conditionally make them true, such as hiding certain fields unless criteria are met:

```js
action Heal(hidden: !self.HasHealing) { . . . }
```

Standardized fields also allow the current `value` of the field to be calculated, making it implicitly `locked`

## Simple Fields

These fields map to standard Foundry schema fields, and with enough effort you could build a system using mostly these.

| **Field**     	| **Datatype** 	| **Summary**                                                                                                                                                                      	| **Standardized**                                  	|
|---------------	|--------------	|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------	|---------------------------------------------------	|
| boolean       	| Boolean      	| Use to store simple yes / no values, such as "Equipped" or "Has Magic". Useful for showing / hiding other fields.                                                                	| Supports tags, but not parameters                 	|
| number        	| Number       	| A basic number field that can be optionally bounded with a min / max, or calculated. Use for currency, amounts, total weight, experience, bonuses, etc.                          	| Yes                                               	|
| string        	| string       	| A basic unformatted single-line textfield. Supports a list of choices. Use for summaries, triggers, simple info, or lists of choices like "Physical" vs "Magic".                 	| Supports tags and some parameters, but not hidden 	|
| html          	| HTML         	| A multi-line formatted text block. Use for Effects, biographies, etc.                                                                                                            	| Supports tags, but not parameters                 	|
| date          	| string         	| Use to store a realworld date, such as "advancement granted" etc.                                                                                                            	| Supports tags, but not parameters                 	|
| time          	| string         	| Use to store a realworld time, such as "last used"  etc.                                                                                                            	| Supports tags, but not parameters                 	|
| datetime          	| string         	| Use to store a realworld date & time, such as "advancement granted" etc.                                                                                                            	| Supports tags, but not parameters                 	|



## Common building blocks

To speed up building and enable certain Foundry features such as Resource bars, these fields wrap common TTRPG concepts and pairs them with ISDL built-in and native Foundry functionality.

| **Field**     	| **Datatype** 	| **Summary**                                                                                                                                                                      	| **Standardized**                                  	|
|---------------	|--------------	|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------	|---------------------------------------------------	|
| resource      	| Complex      	| A special number that wires up resource bars for Tokens and supports "Temporary" values that get removed first. Works with damage application. Use for Health, Mana, Armor, etc. 	| Supports tags and some parameters, but not hidden 	|
| attribute     	| Complex      	| A special number that calculates a mod value. Use for attribute scores.                                                                                                          	| Supports tags and some parameters, but not hidden 	|



## Document Links / Embeds

It's common to want an Document to own or link to other Documents - usually Items, but sometimes other Actors as well. These fields set that up and allow you to "include" that other document's data in this one.

| **Field**     	| **Datatype** 	| **Summary**                                                                                                                                                                      	| **Standardized**                                  	|
|---------------	|--------------	|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------	|---------------------------------------------------	|
| Item Array    	| Array of Item  	| Stores a list of Items on this Actor. Use for owned Equipment, Spells, Features, etc.                                                                                            	| Supports tags and some parameters, but not hidden 	|
| Document Link 	| UUID         	| Links to a single Document via drag & drop. Use for "chosen spell", "equipped helmet", etc.                                                                                                      	| Yes                                               	|
| Parent Field 	| string         	| Allows a user to pick a field, such as a Resource or Attribute, on the Parent document. Use for Attack Mod setup, resource spent on use, etc.                                                                                                      	| Supports tags, but no standard parameters                                               	|
| Document Choice 	| UUID         	| Links to a single Document via a searchable dropdown. Use for "chosen spell", "equipped helmet", etc.                                                                                                      	| Yes                                               	|
| Document Choices 	| Array of UUID         	| Links to multiple Documents via a searchable dropdown. Use for "chosen features", "equipped armor", etc.                                                                                                      	| WIP - Not currently done.                                               	|
| Paperdoll 	| Object of UUID         	| Links to multiple Documents via a set of boxes over an image. Use for "equipped armor" and "equipped weapons", etc.                                                                                                      	| Supports tags, but no standard parameters                                               	|


## Fancy customizations

These make numbers look fancy and have slightly different UX / UI than normal. Really just here for style.

| **Field**     	| **Datatype** 	| **Summary**                                                                                                                                                                      	| **Standardized**                                  	|
|---------------	|--------------	|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------	|---------------------------------------------------	|
| pips          	| Number       	| A special number that renders as pips. Use for small amounts < 10, such as "uses left".                                                                                          	| Supports tags and most parameters, but not hidden 	|
| damagetrack          	| Complex       	| Helps keep track of damage done outside of health, including different types of damage, such as "bludgeoning".                                                                                          	| WIP - Not currently done. 	|

### Boolean
`boolean <ID>` - A basic boolean field, renders as a checkbox. Default of `false`

Example:
```js
boolean Dazed
boolean Weakened
````
![image](https://github.com/user-attachments/assets/1768c6b9-e2ef-47a7-94c8-d564d647ef22)


### Number
`number <ID>` - A basic number field, default of `0`.

Example:
```js
number Experience
```
![image](https://github.com/user-attachments/assets/ad100fb8-c119-4acd-bf6e-f36763973b1d)

Number also supports several optional parameters. Use as many or as few as you would like!

* `icon` - Associates an icon with this property
* `color` - When paired with `icon`, draws the icon in that color.
* `min` - Sets the min value this number can be. Computable.
* `initial` - Sets the initial value this number will have on creation. Static values only, can't be computed.
* `value` - Can be set to either a static or computed value. This will result in the base value of this field always being this output, although Active Effects can still modify the base value. Setting `value` will make the property `readonly` for users. Useful for calculated amounts, such as Defense.
* `max` - Sets the max value this number can be. Computable.

Examples:
```js
number Level(min: 1, max: 10, initial: 5, icon: "fa-solid fa-chart-line", color: #FF7F50)
number Defense(value: {
  return self.Fight + self.Flight
})
```


### String
`string <ID>` - A basic string field, default of `""`. Rendered as a text input by default.

Example:
```js
string Identity
```
![image](https://github.com/user-attachments/assets/5653de4d-38f2-4573-86f8-39e5a9c94788)

A string can also be restricted to a list of choices, which instead renders as a dropdown.

Example:
```js
string Type(choices: ["A", "B", "C"])
```
![image](https://github.com/user-attachments/assets/1ce8b16d-6045-4631-9123-e9bbc6802859)

A string can additionally have a calculated value, which makes it readonly
```js
        string TestReadout(value: "Test")
        string ManaReadout(value: {
            return self.Mana + " Mana left"
        })
```

### HTML
`html <ID>` - A richtext formatting field capable of having content links, inline rolls, and text formatting. Renders twice as wide on a sheet as other Properties. Default of `""`

Example:
```js
html Background
```
![image](https://github.com/user-attachments/assets/fc8c95c8-b62f-479e-bf04-85efed553d5a)


### Resource
`resource <ID>(max: <NUMBER or METHOD>)` - A fancier version of `number`, this generates a `current`, `temp`, and `max` field and enforces `current` being <= `max`. There is no `min` - negatives are allowed. Renders with an animated bar based on how full the resource is.

Example:
`resource InventoryPoints(max: 6)`

![image](https://github.com/user-attachments/assets/8189b9ce-776f-438a-a9cb-f63d1d987faa)


A method can also be provided to calculate the max based on other attributes:
```js
number Warrior
resource Fate(max: {
    return self.Warrior + 6
})
```
![image](https://github.com/user-attachments/assets/4e02c68f-80b0-4398-b0da-c777d7deac8d)

When subtracting from the Resource, temp amounts are automatically removed first.
![isdl-temp](https://github.com/user-attachments/assets/eb98ed0a-6b85-4087-aece-0c5cff637560)

`color` Can be set to customize the coloring of the box:
```js
resource Fate(color: #FFF)
```

`health` or `wounds` marks this resource as the primary one for keeping track of health. This is restricted to one instance per document. Both will do the following:
1. The resource will use a custom red (low) to green (high) resource bar render
1. The resource will become the automatic bar1 resource on Tokens, unless token defaults are setup otherwise
1. Changes to this resource will cause dynamic token rings to flash
1. The resource is what will be modified by the Damage Applicator

```js
        health resource Health(max: {
            return self.Warrior + 6 + self.HealthMod
        })
```

### Attribute
`attribute <ID>(min: <NUMBER or METHOD>, max: <NUMBER or METHOD>, mod: <METHOD>)` - An input number is used to derive a more useful `mod` number that becomes the default value referenced. It can reference it's own base input number.

Example:
```js
attribute Strength(min: 1, max: 30, mod: {
    return (self.Strength - 10) / 2
}
```
![image](https://github.com/user-attachments/assets/9bf4975b-8458-4f3b-9b76-20b3de239d22)


### Pips
`pips <ID>(max: <NUMBER or METHOD>)` - Like a resource, this represents a number that can go up to a max. Unlike a Resource, this min is always 0, and visually this is presented as empty or filled in pips.

Pips have an option between two styles - circles and squares, with squares being the default.

Example:
```js
pips UsesLeft(max: {
    return self.LimitationAmount
}, style: circles)
```
![image](https://github.com/user-attachments/assets/a44ddddb-eaa9-4df9-ac96-c02cbc3d93b5)

Pips also support `initial`:
```js
pips UsesLeft(max: {
    return self.LimitationAmount
}, 
initial: {
    return self.LimitationAmount
}, 
style: circles)
```

### Single Item
`<ITEM NAME> <ID>` - Allows linking to an Item, be it on the same Actor or on another sheet / in the World / in a Compendium. This UX allows dragging an Item to the box to link it.

Example:
```js
Equipment Armor
```

![isdl-single-doc](https://github.com/user-attachments/assets/faa12244-9667-4b41-bc4d-631dcd65544f)


### Item List
`<ITEM NAME>[] <ID>` - A list of 0 or more Items of this Document Type that this Actor owns. Only available on Actor documents. This renders as a table with sort, search, and drag functionality on the sheet.

Example:
```js
actor PC {
    Equipment[] OwnedEquipment
}

item Equipment {
    string Type(choices: ["Armor", "Weapon"])
}
```

![image](https://github.com/user-attachments/assets/2e9a71c4-2a2c-45e6-b9e9-621e30423ff3)

The list of Items can be filtered on properties using the `where` parameter

Examples:
```js
        Equipment[] Armors(where: item.Type equals "Armor")
        Equipment[] Weapons(where: item.Type equals "Weapon")
```